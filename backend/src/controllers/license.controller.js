import os from 'os';
import crypto from 'crypto';
import { getDb } from '../database/connection.js';

// Durée de la licence : 1 An (365 jours en millisecondes)
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const SECRET_SALT = 'GESLO_SECRET_KEY_SALT_2026_PROTECTED';

// Génère une empreinte unique (Code Machine) pour l'ordinateur
export function getMachineId() {
  const rawInfo = `${os.hostname()}-${os.arch()}-${os.platform()}-${os.cpus()?.[0]?.model || 'cpu'}`;
  const hash = crypto.createHash('sha256').update(rawInfo).digest('hex').toUpperCase();
  return `${hash.substring(0, 4)}-${hash.substring(4, 8)}`;
}

// Génère la clé unique spécifique à un Code Machine donné
export function generateKeyForMachine(machineId) {
  const cleanId = String(machineId).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const signature = crypto.createHmac('sha256', SECRET_SALT)
    .update(`GESLO-1YR-${cleanId}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
  return `GESLO-1YR-${cleanId}-${signature}`;
}

// Algorithme de validation des clés de licence 1 An
function isValidLicenseKey(key, currentMachineId) {
  if (!key || typeof key !== 'string') return false;
  const cleanKey = key.trim().toUpperCase();

  // 1. Clés Master / Universelles de réactivation (Administrateur)
  const MASTER_KEYS = [
    'GESLO-ANNUEL-MASTER-2026',
    'GESLO-1YR-MASTER-KEY',
    'GESLO2026-KEY-1YR',
    'GESLO2026',
    'GESL0!N!T2026',
  ];

  if (MASTER_KEYS.includes(cleanKey)) return true;

  // 2. Clé unique liée au Code Machine de CET ordinateur
  const expectedKeyForCurrentMachine = generateKeyForMachine(currentMachineId);
  if (cleanKey === expectedKeyForCurrentMachine) return true;

  // 3. Vérification générique du format GESLO-1YR-MACHINEID-SIGNATURE
  if (cleanKey.startsWith('GESLO-1YR-')) {
    const parts = cleanKey.split('-');
    if (parts.length === 4) {
      const targetMachineId = `${parts[2].substring(0, 4)}-${parts[2].substring(4, 8)}`;
      const expectedKey = generateKeyForMachine(targetMachineId);
      if (cleanKey === expectedKey) return true;
    }
  }

  return false;
}

export async function getLicenseStatus(req, res) {
  try {
    const db = getDb();
    const machineId = getMachineId();
    const license = await db.prepare(
      'SELECT * FROM license_info ORDER BY id DESC LIMIT 1'
    ).get();

    if (!license) {
      return res.json({
        is_valid: false,
        status: 'unlicensed',
        machine_id: machineId,
        message: 'Aucune licence 1 An n\'est actuellement activée sur ce poste.',
        days_left: 0,
      });
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);
    const lastChecked = new Date(license.last_checked_at || license.activated_at);

    // Détection de modification de l'horloge système (anti-triche)
    if (now.getTime() < lastChecked.getTime() - 120000) { // Marge de 2 minutes
      return res.json({
        is_valid: false,
        status: 'clock_tampered',
        machine_id: machineId,
        message: 'Horloge système modifiée. L\'accès est verrouillé par sécurité.',
        days_left: 0,
        expires_at: license.expires_at,
      });
    }

    // Mise à jour du dernier contrôle horodaté
    await db.prepare('UPDATE license_info SET last_checked_at = ? WHERE id = ?')
      .run(now.toISOString(), license.id);

    // Vérification de l'expiration des 365 jours
    if (now > expiresAt) {
      if (license.status !== 'expired') {
        await db.prepare('UPDATE license_info SET status = \'expired\' WHERE id = ?').run(license.id);
      }
      return res.json({
        is_valid: false,
        status: 'expired',
        machine_id: machineId,
        message: 'Votre licence de 1 An a expiré. Veuillez saisir une nouvelle clé de réactivation.',
        days_left: 0,
        expires_at: license.expires_at,
      });
    }

    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return res.json({
      is_valid: true,
      status: 'active',
      machine_id: machineId,
      license_key: license.license_key,
      activated_at: license.activated_at,
      expires_at: license.expires_at,
      days_left: Math.max(0, daysLeft),
      message: `Licence active (Expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}).`,
    });
  } catch (err) {
    console.error('Erreur getLicenseStatus:', err);
    res.status(500).json({ error: 'Erreur lors du contrôle de la licence.' });
  }
}

export async function activateLicense(req, res) {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'La clé de licence est requise.' });
    }

    const machineId = getMachineId();

    if (!isValidLicenseKey(key, machineId)) {
      return res.status(400).json({
        error: 'Clé de licence invalide ou non attribuée à cet ordinateur.'
      });
    }

    const db = getDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ONE_YEAR_MS);

    const result = await db.prepare(
      `INSERT INTO license_info (license_key, activated_at, expires_at, last_checked_at, status)
       VALUES (?, ?, ?, ?, 'active')`
    ).run(key.trim().toUpperCase(), now.toISOString(), expiresAt.toISOString(), now.toISOString());

    return res.json({
      success: true,
      message: 'Félicitations ! Votre licence 1 An a été activée avec succès sur ce poste.',
      license_id: result.lastInsertRowid,
      expires_at: expiresAt.toISOString(),
      days_left: 365,
    });
  } catch (err) {
    console.error('Erreur activateLicense:', err);
    res.status(500).json({ error: 'Erreur lors de l\'activation de la licence.' });
  }
}

// Route optionnelle réservée à l'administrateur pour générer une clé unique pour un client
export async function generateKeyEndpoint(req, res) {
  try {
    const { target_machine_id } = req.body;
    if (!target_machine_id) {
      return res.status(400).json({ error: 'Le Code Machine client (target_machine_id) est requis.' });
    }
    const generatedKey = generateKeyForMachine(target_machine_id);
    return res.json({
      machine_id: target_machine_id.toUpperCase(),
      license_key: generatedKey,
      validity: '1 An (365 jours)',
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur génération clé.' });
  }
}

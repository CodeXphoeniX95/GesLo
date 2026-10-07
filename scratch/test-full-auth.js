import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../backend/src/config/config.js';
import getDb from '../backend/src/database/connection.js';
import dotenv from 'dotenv';
dotenv.config();

async function testFullAuthCycle(username) {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const db = getDb();

  console.log(`\n🔑 Test du cycle complet d authentification pour: ${username}`);
  
  // 1. Connexion
  const user = await db.prepare(
    `SELECT u.*, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = ? AND u.is_active = 1`
  ).get(username);

  if (!user) {
    console.error('❌ Utilisateur non trouvé !');
    return;
  }

  // 2. Génération token
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
  console.log('🎫 Token généré avec succès !');

  // 3. Vérification du middleware d authentification (simulé)
  const payload = jwt.verify(token, JWT_SECRET);
  const authUser = await db.prepare(
    'SELECT u.id, u.username, u.full_name, u.is_active, r.name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?'
  ).get(payload.userId);

  if (authUser && authUser.is_active) {
    console.log('✅ VALIDE ! Session active confirmée pour :', authUser.username, '(Rôle:', authUser.role, ')');
  } else {
    console.error('❌ ÉCHEC ! Le middleware a rejeté la session.');
  }
}

async function run() {
  await testFullAuthCycle('admin@gmail.com');
  await testFullAuthCycle('goyitresor@gmail.com');
}

run();

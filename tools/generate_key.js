import crypto from 'crypto';

const SECRET_SALT = 'GESLO_SECRET_KEY_SALT_2026_PROTECTED';

const machineIdArg = process.argv[2];

if (!machineIdArg) {
  console.log('\n=== GESLO - Générateur de Clés de Licence Unique (1 An) ===\n');
  console.log('Usage : node tools/generate_key.js <CODE_MACHINE_CLIENT>');
  console.log('Exemple : node tools/generate_key.js A8F3-91B4\n');
  process.exit(1);
}

const cleanId = String(machineIdArg).replace(/[^A-Z0-9]/gi, '').toUpperCase();

if (cleanId.length < 4) {
  console.error('Erreur : Le Code Machine doit comporter au moins 4 caractères.');
  process.exit(1);
}

const signature = crypto.createHmac('sha256', SECRET_SALT)
  .update(`GESLO-1YR-${cleanId}`)
  .digest('hex')
  .substring(0, 8)
  .toUpperCase();

const licenseKey = `GESLO-1YR-${cleanId}-${signature}`;

console.log('\n======================================================');
console.log('🎉 GESLO — Clé de Licence Unique Générée (1 An / 365 Jours)');
console.log('======================================================');
console.log(`Code Machine Client : ${machineIdArg.toUpperCase()}`);
console.log(`Clé de Licence      : ${licenseKey}`);
console.log('======================================================\n');

import getDb from '../backend/src/database/connection.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

async function testFullLogin(username, password) {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const db = getDb();

  console.log(`\n🔍 Test de connexion pour: ${username}...`);
  const user = await db.prepare(
    `SELECT u.*, r.name AS role FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = ? AND u.is_active = 1`
  ).get(username);

  if (!user) {
    console.error('❌ Utilisateur non trouvé !');
    return;
  }

  console.log('👤 Utilisateur trouvé dans la BD:', user.username, 'Rôle:', user.role);

  const match = bcrypt.compareSync(password, user.password_hash);
  if (match) {
    console.log('✅ CONNEXION RÉUSSIE ! Mot de passe valide.');
  } else {
    console.error('❌ Mot de passe incorrect !');
  }
}

async function runTests() {
  await testFullLogin('admin@gmail.com', 'Pass1234');
  await testFullLogin('goyitresor@gmail.com', 'Pass1234');
}

runTests();

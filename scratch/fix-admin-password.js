import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket }
});

async function addCustomAdmin() {
  const hash = bcrypt.hashSync('Pass1234', 10);
  console.log('Hash bcrypt pour Pass1234 :', hash);

  const { data, error } = await supabase
    .from('users')
    .upsert([
      {
        id: 1,
        username: 'goyitresor@gmail.com',
        password_hash: hash,
        full_name: 'Trésor Goyi',
        role_id: 1,
        is_active: 1
      }
    ]);

  if (error) {
    console.error('Erreur insertion utilisateur goyitresor@gmail.com:', error.message);
  } else {
    console.log('✅ Utilisateur goyitresor@gmail.com créé/mis à jour dans Supabase avec le mot de passe Pass1234 !');
  }
}

addCustomAdmin();

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

async function addAdminUser() {
  const hash = bcrypt.hashSync('Pass1234', 10);

  // Vérifier si l'utilisateur existe déjà
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', 'admin@gmail.com')
    .single();

  let res;
  if (existing) {
    res = await supabase
      .from('users')
      .update({
        password_hash: hash,
        full_name: 'Admin',
        role_id: 1,
        is_active: 1
      })
      .eq('id', existing.id);
  } else {
    res = await supabase
      .from('users')
      .insert([
        {
          username: 'admin@gmail.com',
          password_hash: hash,
          full_name: 'Admin',
          role_id: 1,
          is_active: 1
        }
      ]);
  }

  if (res.error) {
    console.error('Erreur insertion admin@gmail.com:', res.error.message);
  } else {
    console.log('✅ Nouvel utilisateur admin@gmail.com créé/mis à jour dans Supabase avec le mot de passe Pass1234 !');
  }
}

addAdminUser();

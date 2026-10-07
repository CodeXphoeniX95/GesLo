import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket }
});

async function testUsers() {
  const { data, error } = await supabase.from('users').select('id, username, full_name, role_id, is_active');
  if (error) {
    console.error(error);
  } else {
    console.log('Utilisateurs enregistrés dans Supabase :', data);
  }
}

testUsers();

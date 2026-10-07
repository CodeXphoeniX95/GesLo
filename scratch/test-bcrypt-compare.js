import bcryptjs from 'bcryptjs';
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

async function testLogin() {
  const { data: user, error } = await supabase
    .from('users')
    .select('*, roles(name)')
    .or('username.eq.admin@gmail.com,username.eq.goyitresor@gmail.com')
    .limit(1)
    .single();

  if (error || !user) {
    console.error('User not found:', error);
    return;
  }

  console.log('User found in DB:', user.username);
  console.log('Stored Password Hash:', user.password_hash);

  const match = bcryptjs.compareSync('Pass1234', user.password_hash);
  console.log('Does Pass1234 match stored hash?:', match);
}

testLogin();

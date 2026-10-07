import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('Testing Supabase Client...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket }
});

async function test() {
  try {
    const { data, error } = await supabase.from('roles').select('*');
    if (error) {
      console.log('Supabase query result (error or table not created yet):', error.message);
    } else {
      console.log('✅ Supabase connected successfully! Roles:', data);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

test();

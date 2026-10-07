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

async function testQueryUser(username) {
  const { data, error } = await supabase
    .from('users')
    .select('*, roles(name)')
    .eq('username', username)
    .eq('is_active', 1);

  console.log('Query result for', username, ':', data, 'Error:', error);
}

testQueryUser('admin@gmail.com');
testQueryUser('goyitresor@gmail.com');

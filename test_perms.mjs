import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54641';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('v_permissoes_efetivas').select('*');
  if (error) console.error(error);
  console.log("ALL PERMISSIONS:", JSON.stringify(data, null, 2));
}

run();

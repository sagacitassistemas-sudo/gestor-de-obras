import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54641';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: perms, error: e1 } = await supabase.from('v_permissoes_efetivas').select('*').eq('email', 'sargebucc@gmail.com');
  console.log("Efetivas sargebucc@gmail.com:", JSON.stringify(perms, null, 2));
}

run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54641';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error: e1 } = await supabase.from('usuarios').select('*');
  console.log("USUARIOS:", JSON.stringify(users, null, 2));

  const { data: perms, error: e2 } = await supabase.from('permissoes_usuario').select('*');
  console.log("PERMISSOES_USUARIO:", JSON.stringify(perms, null, 2));
}

run();

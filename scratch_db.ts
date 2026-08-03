import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL?.replace(/^["']|["']$/g, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^["']|["']$/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing v_permissoes_efetivas...");
  const { data, error } = await supabase.from('v_permissoes_efetivas').select('*').limit(1);
  console.log("v_permissoes_efetivas ERROR:", error);

  console.log("Testing projetos...");
  const { data: pData, error: pError } = await supabase.from('projetos').select('*').limit(1);
  console.log("projetos ERROR:", pError);
}

test();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54641';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: pe, error: e1 } = await supabase.from('permissoes_empresa').select('*');
  console.log("PERMISSOES_EMPRESA:", JSON.stringify(pe, null, 2));
}

run();

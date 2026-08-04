require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: pe, error } = await supabase.from('permissoes_empresa').select('*').eq('empresa_id', 'SEM-EMPRESA');
  console.log('Permissoes Empresa SEM-EMPRESA:', pe, error);
}
run();

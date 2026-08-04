require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { error: e1 } = await supabase.from('permissoes_usuario').update({ empresa_id: null }).in('empresa_id', ['SEM-EMPRESA', 'GER-2026-SYS']);
  console.log('Fixed permissoes_usuario:', e1);
  const { error: e2 } = await supabase.from('usuarios').update({ empresa_id: null }).in('empresa_id', ['SEM-EMPRESA', 'GER-2026-SYS']);
  console.log('Fixed usuarios:', e2);
}
run();

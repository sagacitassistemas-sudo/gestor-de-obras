require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const email = 'sstulzer@gmail.com';
  const { data: u } = await supabase.from('usuarios').select('*').eq('email', email).single();
  const { data: ve, error } = await supabase.from('v_permissoes_efetivas').select('*').eq('usuario_uid', u.uid);
  console.log('Permissoes Efetivas View:', ve, 'Error:', error);
}
run();

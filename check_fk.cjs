require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: `
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'permissoes_usuario'::regclass
      AND confrelid = 'usuarios'::regclass;
  `});
  console.log('Constraint:', data, error);
}
run();

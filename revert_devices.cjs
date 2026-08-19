const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54641';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Revertendo dispositivo RDO-DEV-7492 para PENDENTE...');
  const { data, error } = await supabase
    .from('dispositivos_mobile')
    .update({ status: 'PENDENTE' })
    .eq('device_id', 'RDO-DEV-7492')
    .select();

  if (error) {
    console.error('Erro:', error);
  } else {
    console.log('Dispositivos revertidos:', data.length);
    console.log(data);
  }
}
run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const upsertData = {
    uid: '3G1JNHecTNNTimjaxkUxxTfb9qY2',
    email: 'sagacitas.sistemas@gmail.com',
    nome: 'sagacitas sistemas',
    contrato_id: 'CTR-2026-SYS',
    perfil: 'ADMIN',
    status: 'ATIVO',
    empresa_id: 'GER-2026-SYS',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('usuarios').upsert(upsertData, { onConflict: 'uid' }).select().single();
  console.log("RESULT DATA:", data);
  console.log("RESULT ERROR:", error);
}

main();

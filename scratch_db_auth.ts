import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL?.replace(/^["']|["']$/g, '');
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.replace(/^["']|["']$/g, '');
const jwtSecret = process.env.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";

const token = jwt.sign({
  role: "authenticated",
  sub: "3G1JNHecTNNTimjaxkUxxTfb9qY2",
  contrato_id: "CTR-2026-SYS",
  perfil: "ADMIN"
}, jwtSecret);

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});

async function test() {
  console.log("Testing v_permissoes_efetivas as authenticated...");
  const { data, error } = await supabase.from('v_permissoes_efetivas').select('*').eq("usuario_uid", "3G1JNHecTNNTimjaxkUxxTfb9qY2").limit(1);
  console.log("v_permissoes_efetivas ERROR:", error);

  console.log("Testing projetos as authenticated...");
  const { data: pData, error: pError } = await supabase.from('projetos').select('*').limit(1);
  console.log("projetos ERROR:", pError);
}

test();

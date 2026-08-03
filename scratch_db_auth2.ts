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
  const { data: pData, error: pError } = await supabase.from('projetos').select('*').limit(5);
  console.log("PROJETOS DATA:", pData);
}

test();

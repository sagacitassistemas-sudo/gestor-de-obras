import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const jwtSecret = process.env.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";

function getSimulatedClient(uid: string, contrato_id: string, perfil: string) {
  const token = jwt.sign(
    {
      role: "authenticated",
      sub: uid,
      contrato_id,
      perfil
    },
    jwtSecret
  );
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

async function main() {
  const client = getSimulatedClient('3G1JNHecTNNTimjaxkUxxTfb9qY2', 'CTR-2026-SYS', 'ADMIN');
  const { data, error } = await client.from('usuarios').select('*');
  console.log("RLS QUERY RESULT DATA:", data);
  console.log("RLS QUERY RESULT ERROR:", error);
}

main();

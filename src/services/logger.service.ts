import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ override: true });

const supabaseUrl = process.env.SUPABASE_URL?.replace(/^["']|["']$/g, '') || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^["']|["']$/g, '') || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.replace(/^["']|["']$/g, '');

const targetKey = (supabaseServiceKey && !supabaseServiceKey.startsWith("sb_secret_zeBtO4vusXk"))
  ? supabaseServiceKey
  : (supabaseAnonKey || supabaseServiceKey);

let supabaseAdmin: SupabaseClient | null = null;
if (supabaseUrl && targetKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, targetKey);
  } catch (err) {
    console.error("Failed to initialize Supabase admin client for logger:", err);
  }
}

export async function logAudit(
  client: SupabaseClient,
  params: {
    contrato_id: string;
    usuario_uid?: string;
    usuario_email?: string;
    cod_evento: string;
    descricao?: string;
    entidade_tipo?: string;
    entidade_id?: string;
    ip_origem?: string;
  }
) {
  try {
    const { error } = await client.from("audit_log").insert([params]);
    if (error) console.error("[Compliance] Erro ao registrar log de auditoria:", error);
  } catch (err) {
    console.error("[Compliance] Exceção ao registrar log de auditoria:", err);
  }
}

export async function logSystemError(
  params: {
    contrato_id?: string;
    usuario_uid?: string;
    cod_evento: string;
    rota?: string;
    mensagem: string;
    stack_trace?: string;
  }
) {
  try {
    if (process.env.NODE_ENV === 'test') {
      return; // Prevenir poluição do banco de dados durante a execução dos testes
    }
    
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from("system_error_log").insert([params]);
      if (error) console.error("[Compliance] Erro ao registrar falha do sistema:", error);
    }
  } catch (err) {
    console.error("[Compliance] Exceção ao registrar falha do sistema:", err);
  }
}

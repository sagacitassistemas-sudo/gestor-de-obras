/**
 * server.lib.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Biblioteca de helpers compartilhados entre server.ts e os route modules.
 *
 * REGRA: este arquivo NÃO deve importar nada de server.ts para evitar
 * dependência circular. Toda dependência vem de módulos de terceiros ou de
 * outros arquivos em src/.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { AuthenticatedRequest } from "../types/middleware.types";
import { logSystemError, logAudit } from "../services/logger.service";
import { SYSTEM_PARAMS } from "../constants/system.constants";
import { getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

// ─── Supabase URLs (lidos do ambiente uma única vez) ──────────────────────────
export const supabaseUrl = process.env.SUPABASE_URL?.replace(/^['"']|['"']$/g, "");
export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^['"']|['"']$/g, "");
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.replace(/^['"']|['"']$/g, "");

// ─── Singleton do client de serviço (backend, bypassa RLS) ───────────────────
let _supabase: SupabaseClient | null = null;

export function getGlobalSupabaseClient(): SupabaseClient | null {
  if (_supabase) return _supabase;
  if (!supabaseUrl) return null;
  const key = supabaseServiceKey || supabaseAnonKey;
  if (!key) return null;
  try {
    _supabase = createClient(supabaseUrl, key);
  } catch {
    return null;
  }
  return _supabase;
}

/**
 * Injeta o singleton global como client por request.
 * A segurança de tenant é garantida pelas queries explícitas (.eq("contrato_id",...)).
 */
export function getSupabaseClient(req: AuthenticatedRequest): SupabaseClient | null {
  if (!supabaseUrl || !req.decodedToken) return null;
  return getGlobalSupabaseClient();
}

/** Client com service role key, para endpoints admin sem contexto de req */
export function getServiceRoleClient(): SupabaseClient {
  return createClient(supabaseUrl!, supabaseServiceKey!);
}

// ─── CRUD helper ─────────────────────────────────────────────────────────────
/**
 * Coordena INSERT vs UPDATE vs UPSERT de forma segura.
 *
 * ATENÇÃO: use onConflict SOMENTE quando a coluna possuir UNIQUE/PK real no banco.
 * Se `id` vier undefined/null do frontend, faz INSERT puro (PostgreSQL gera o UUID).
 */
export async function saveRecord(
  client: SupabaseClient,
  table: string,
  data: any,
  options: { idField?: string; onConflict?: string; single?: boolean } = {},
) {
  const idField = options.idField || "id";
  const onConflict = options.onConflict;
  const single = options.single !== false; // default true

  const idValue = data[idField];
  const hasIdValue = idValue !== undefined && idValue !== null && idValue !== "";

  let query: any;

  if (onConflict) {
    const conflictFields = onConflict.split(",").map((s) => s.trim());
    if (conflictFields.includes(idField) && !hasIdValue) {
      const insertData = { ...data };
      delete insertData[idField];
      query = client.from(table).insert([insertData]);
    } else {
      query = client.from(table).upsert(data, { onConflict });
    }
  } else {
    if (hasIdValue) {
      query = client.from(table).update(data).eq(idField, idValue);
    } else {
      const insertData = { ...data };
      delete insertData[idField];
      query = client.from(table).insert([insertData]);
    }
  }

  query = query.select();
  if (single) query = query.single();
  return await query;
}

// ─── Permissões ───────────────────────────────────────────────────────────────
const PERM_DEFAULTS: Record<string, boolean> = {
  empresas_ler: true,
  projetos_ler: true,
  medicoes_ler: false,
  financeiro_ler: false,
  relatorios_ler: false,
  usuarios_ler: false,
  empresas_criar: false,
  empresas_editar: false,
  empresas_excluir: false,
  projetos_criar: false,
  projetos_editar: false,
  projetos_excluir: false,
  medicoes_criar: false,
  medicoes_editar: false,
  medicoes_excluir: false,
  financeiro_criar: false,
  financeiro_editar: false,
  financeiro_excluir: false,
  usuarios_criar: false,
  usuarios_editar: false,
  usuarios_excluir: false,
};

export async function getComputedPermissions(
  req: AuthenticatedRequest,
): Promise<Record<string, boolean>> {
  if (!req.decodedToken) return {};

  const perfil = req.decodedToken.perfil || "VISITANTE";
  const uid = req.decodedToken.uid;
  const contrato_id = req.decodedToken.contrato_id;
  const fallback = { ...PERM_DEFAULTS };

  if (perfil === "ADMIN") {
    Object.keys(fallback).forEach((k) => (fallback[k] = true));
    return fallback;
  }
  if (perfil === "GESTOR") {
    Object.keys(fallback).forEach((k) => { if (!k.startsWith("usuarios_")) fallback[k] = true; });
  } else if (perfil === "FINANCEIRO") {
    Object.keys(fallback).forEach((k) => { if (k.startsWith("financeiro_")) fallback[k] = true; });
  }

  try {
    const client = getSupabaseClient(req);
    if (!client) return fallback;

    const { data: effectiveData } = await client
      .from("v_permissoes_efetivas")
      .select("*")
      .eq("usuario_uid", uid)
      .maybeSingle();

    if (effectiveData?.empresas_ler !== undefined) return { ...fallback, ...effectiveData };

    const { data: typeData } = await client
      .from("permissoes_tipo")
      .select("*")
      .eq("perfil", perfil)
      .eq("contrato_id", contrato_id)
      .maybeSingle();

    if (typeData?.empresas_ler !== undefined) return { ...fallback, ...typeData };
  } catch (err: any) {
    console.error("Error computing permissions:", err);
    await logSystemError({
      contrato_id,
      usuario_uid: uid,
      cod_evento: "SYS_PERM_ENGINE_ERROR",
      mensagem: `Erro ao calcular permissões: ${err.message}`,
      stack_trace: err.stack,
    });
  }
  return fallback;
}

/** Helper inline para checar permissão em endpoints. ADMIN sempre passa. */
export async function checkPermission(
  req: AuthenticatedRequest,
  permissionKey: string,
): Promise<boolean> {
  if (req.decodedToken?.perfil === "ADMIN") return true;
  const perms = await getComputedPermissions(req);
  const granted = !!perms[permissionKey];

  if (!granted) {
    await logSystemError({
      contrato_id: req.decodedToken?.contrato_id,
      usuario_uid: req.decodedToken?.uid,
      cod_evento: "PERM_DENIED",
      rota: req.originalUrl,
      mensagem: `Acesso negado. Requer permissão: ${permissionKey}`,
    });
  }
  return granted;
}

// ─── Firebase Admin helpers ───────────────────────────────────────────────────
export function getSafeAdminAuth() {
  try {
    const { getAuth } = require("firebase-admin/auth");
    return getAdminApps().length > 0 ? getAuth() : null;
  } catch {
    return null;
  }
}

export async function ensureUserExists(
  client: SupabaseClient,
  token: { uid: string; email: string; nome?: string; photoURL?: string },
) {
  if (!client || !token || !token.uid) return null;

  const userEmail = token.email || `${token.uid}@user.com`;

  // 1. Check if user already exists by uid OR email
  const { data: existingUserRows } = await client
    .from("usuarios")
    .select("*")
    .or(`uid.eq.${token.uid},email.eq.${userEmail}`)
    .limit(1);
  const existingUser = existingUserRows?.[0] || null;

  if (existingUser) {
    // If user exists, ensure uid matches
    if (existingUser.uid !== token.uid) {
      const { error: updateErr } = await client
        .from("usuarios")
        .update({ uid: token.uid })
        .eq("email", userEmail);
      if (updateErr) {
        console.error(
          "[ensureUserExists] Erro ao atualizar UID do usuário:",
          updateErr,
        );
      } else {
        existingUser.uid = token.uid;
      }
    }

    // Sync custom claims for existing user on every login (SYSTEM_PARAMS.CLAIMS_SYNC_ENABLED)
    // Also clears the claims_pendentes flag set by POST /api/usuarios when profile changes
    if (SYSTEM_PARAMS.CLAIMS_SYNC_ENABLED) {
      try {
        const adminAuth = getAdminApps().length > 0 ? getAdminAuth() : null;
        if (adminAuth && typeof adminAuth.setCustomUserClaims === "function") {
          await adminAuth.setCustomUserClaims(token.uid, {
            perfil: existingUser.perfil,
            contrato_id: existingUser.contrato_id,
            empresa_id: existingUser.empresa_id,
            entidade_id: existingUser.empresa_id,
          });
          // Clear the pending claims flag if it was set
          if (existingUser.claims_pendentes) {
            await client
              .from("usuarios")
              .update({ claims_pendentes: false })
              .eq("uid", token.uid);
          }
          console.log(
            `[ensureUserExists] Claims sincronizados para ${userEmail} (perfil: ${existingUser.perfil})`,
          );
        }
      } catch (claimsErr) {
        console.error(
          "[ensureUserExists] Erro ao sincronizar claims do usuário existente:",
          claimsErr,
        );
        await logSystemError({
          usuario_uid: token.uid,
          contrato_id: existingUser.contrato_id,
          cod_evento: "CLAIMS_SYNC_FAIL",
          rota: "ensureUserExists",
          mensagem: `Falha ao sincronizar claims Firebase: ${claimsErr}`,
        });
      }
    }

    return existingUser;
  }

  // 2. Count users to handle First Admin vs Visitante
  const { count } = await client
    .from("usuarios")
    .select("*", { count: "exact", head: true });

  const isDbEmpty = !count || count === 0;

  const contrato_id = "CTR-2026-SYS";
  const empresa_id = isDbEmpty ? "GER-2026-SYS" : null;
  const perfil = isDbEmpty ? "ADMIN" : "VISITANTE";
  const nome = token.nome || userEmail.split("@")[0];

  if (isDbEmpty) {
    await client.from("empresas_fornecedores").upsert(
      {
        id: "GER-2026-SYS",
        contrato_id: "CTR-2026-SYS",
        nome: "Gestora do Sistema",
        cnpj_cpf: "00.000.000/0001-00",
        tipo: "CONTRATANTE",
        status: "ATIVO",
        total_faturado: 0,
      },
      { onConflict: "id, contrato_id" },
    );
  }

  // 3. Insert user record
  const newUser = {
    uid: token.uid,
    email: userEmail,
    nome,
    foto_url: token.photoURL || "",
    contrato_id,
    empresa_id: isDbEmpty ? empresa_id : null,
    perfil,
    status: "ATIVO",
  };

  const { data: insertedUser, error: insertErr } = await client
    .from("usuarios")
    .insert([newUser])
    .select("*")
    .single();

  if (insertErr) {
    console.error("[ensureUserExists] Erro ao inserir usuário:", insertErr);
    return null;
  }

  // 4. Seed default permissions from permissoes_tipo
  try {
    const { data: tipoData } = await client
      .from("permissoes_tipo")
      .select("*")
      .eq("contrato_id", contrato_id)
      .eq("perfil", perfil)
      .maybeSingle();

    if (tipoData) {
      const newPerms = { ...tipoData };
      delete newPerms.id;
      delete newPerms.perfil;
      delete newPerms.created_at;
      delete newPerms.updated_at;
      newPerms.usuario_uid = token.uid;
      newPerms.empresa_id = empresa_id;
      // Removed e_customizada as it does not exist in the database schema
      await client.from("permissoes_usuario").insert([newPerms]);
    }
  } catch (permErr) {
    console.error("[ensureUserExists] Erro ao atribuir permissões:", permErr);
  }

  // 5. Update custom claims in Firebase Admin if configured
  try {
    const adminAuth = getSafeAdminAuth();
    if (adminAuth) {
      const baseClaims = {
        perfil,
        contrato_id,
        empresa_id: empresa_id || undefined,
        entidade_id: empresa_id || undefined,
      };
      await injectPermissionsIntoClaims(adminAuth, client, token.uid, baseClaims);
    }
  } catch (claimsErr) {
    // Ignore
  }

  console.log(
    `[ensureUserExists] Auto-registrado usuário ${userEmail} como ${perfil}.`,
  );
  return insertedUser;
}

export async function injectPermissionsIntoClaims(
  adminAuth: any,
  client: SupabaseClient | null,
  uid: string,
  baseClaims: { perfil: string; contrato_id: string; empresa_id?: string; entidade_id?: string; mfa_verified?: boolean; auth_provider?: string }
): Promise<any> {
  const fullClaims = { ...baseClaims };
  if (!client) {
    // Falha silenciosa de banco, aplica claims básicos
    await adminAuth.setCustomUserClaims(uid, fullClaims).catch(() => {});
    return fullClaims;
  }
  
  try {
    // Otimização: ler v_permissoes_efetivas diretamente (replica logica do getComputedPermissions sem precisar de req)
    const { data: effectiveData } = await client
      .from("v_permissoes_efetivas")
      .select("*")
      .eq("usuario_uid", uid)
      .maybeSingle();

    if (effectiveData && effectiveData.empresas_ler !== undefined) {
      Object.assign(fullClaims, effectiveData);
    } else {
      // Fallback para permissoes_tipo
      const { data: typeData } = await client
        .from("permissoes_tipo")
        .select("*")
        .eq("perfil", baseClaims.perfil)
        .eq("contrato_id", baseClaims.contrato_id)
        .maybeSingle();
        
      if (typeData && typeData.empresas_ler !== undefined) {
        Object.assign(fullClaims, typeData);
      }
    }
  } catch (err) {
    console.error("Erro ao puxar permissões detalhadas para o Firebase Token:", err);
  }
  
  try {
    await adminAuth.setCustomUserClaims(uid, fullClaims);
  } catch (claimsErr) {
    console.warn("Firebase setCustomUserClaims falhou:", claimsErr);
  }
  
  return fullClaims;
}


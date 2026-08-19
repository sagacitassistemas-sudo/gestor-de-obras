import { Request, Response, NextFunction } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { AuthenticatedRequest } from "./verifyFirebaseJWT";

export interface MobileAuthenticatedRequest extends AuthenticatedRequest {
  userContext?: {
    contrato_id: string;
    funcionario_id: string;
    empresa_id: string;
    nome?: string;
    cargo_nome?: string;
  };
}

export const mobileAuthMiddleware = (getSupabaseClient: (req: Request) => SupabaseClient | null) => {
  return async (req: MobileAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = getSupabaseClient(req);
      const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";
      const emailFirebase = req.decodedToken?.email;

      if (!client) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!emailFirebase) {
        return res.status(401).json({ error: "Token Firebase inválido ou sem email." });
      }

      // 1. Resolução de Tenant: Buscar funcionário pelo email no tenant
      const { data: funcionario, error: funcError } = await client
        .from("funcionarios")
        .select("id, empresa_id")
        .eq("tenant_id", tenantId)
        .eq("email", emailFirebase)
        .maybeSingle();

      if (funcError) {
        console.error("[BFF] Erro ao buscar funcionário:", funcError);
        return res.status(500).json({ error: "Erro interno ao validar usuário." });
      }

      if (!funcionario) {
        console.warn(`[BFF] Funcionário não encontrado para email: ${emailFirebase} no tenant: ${tenantId}`);
        return res.status(404).json({
          error: "FuncionarioNaoCadastrado",
          message: `Nenhum funcionário cadastrado com o email "${emailFirebase}" neste contrato. Solicite ao gestor da obra o seu cadastro como funcionário no sistema.`,
          email: emailFirebase,
          tenant: tenantId,
        });
      }

      if (!funcionario.empresa_id) {
        return res.status(404).json({
          error: "FuncionarioSemEmpresa",
          message: "Seu cadastro de funcionário não está vinculado a nenhuma empresa. Solicite ao gestor da obra a vinculação.",
          funcionarioId: funcionario.id
        });
      }

      // 2. Carteira de Dispositivos (Zero Trust)
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(401).json({
          error: "MissingDeviceId",
          message: "Acesso negado. Dispositivo não identificado."
        });
      }

      // Buscar dispositivo na carteira
      const { data: deviceData, error: deviceError } = await client
        .from("dispositivos_mobile")
        .select("status")
        .eq("tenant_id", tenantId)
        .eq("device_id", deviceId)
        .maybeSingle();

      if (deviceError) {
        console.error("[BFF] Erro ao consultar dispositivo:", deviceError);
        return res.status(500).json({ error: "Erro interno ao validar dispositivo." });
      }

      // Auto-registro silencioso se não existir
      if (!deviceData) {
        const ua = req.headers["user-agent"] || "Unknown";
        const { error: insertError } = await client
          .from("dispositivos_mobile")
          .insert([{
            tenant_id: tenantId,
            device_id: deviceId,
            funcionario_id: funcionario.id,
            status: "PENDENTE",
            modelo: ua.substring(0, 100)
          }]);

        if (insertError) {
          console.error("[BFF] Erro ao registrar dispositivo pendente:", insertError);
        }

        return res.status(403).json({
          error: "DispositivoPendente",
          message: "Novo dispositivo detectado e enviado para aprovação. Aguarde a liberação do gestor da obra."
        });
      }

      // Verifica status do dispositivo
      if (deviceData.status === "BLOQUEADO") {
        return res.status(403).json({
          error: "DispositivoBloqueado",
          message: "Acesso bloqueado para este dispositivo."
        });
      }

      if (deviceData.status === "PENDENTE") {
        return res.status(403).json({
          error: "DispositivoPendente",
          message: "Este dispositivo ainda está aguardando liberação do gestor da obra."
        });
      }

      // Se APROVADO, atualiza last_login
      if (deviceData.status === "APROVADO") {
         await client
          .from("dispositivos_mobile")
          .update({ last_login: new Date().toISOString() })
          .eq("tenant_id", tenantId)
          .eq("device_id", deviceId);
      }

      // 3. Injeção do userContext para os controllers
      req.userContext = {
        contrato_id: tenantId,
        funcionario_id: funcionario.id,
        empresa_id: funcionario.empresa_id
      };

      return next();
    } catch (error) {
      console.error("[BFF] Middleware Auth erro:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
};

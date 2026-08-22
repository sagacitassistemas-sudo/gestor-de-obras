import { Router } from "express";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import { getSupabaseClient, checkPermission, saveRecord } from "../lib/server.lib";

const router = Router();

// In-memory store fallback for Empresa Contratante (initialized empty to eliminate mock data as requested)
const inMemoryContratantes = new Map<string, any>();

// In-memory store fallback for Empresas Fornecedoras (initialized empty to eliminate mock data as requested)
const inMemoryEmpresas = new Map<string, any[]>();

  // GET Empresa Contratante
  router.get(
    "/api/contratante",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      const contrato_id = req.decodedToken.contrato_id;
      const emptyTemplate = {
        natureza: "Publica",
        nome: "",
        area: "",
        departamento: "",
        cnpj: "",
        email: "",
        telefone: "",
        gestorResponsavel: "",
        unidadeAdministrativa: "",
      };
      try {
        const client = getSupabaseClient(req);
        if (!client) {
          const localData =
            inMemoryContratantes.get(contrato_id) || emptyTemplate;
          return res.json({
            success: true,
            data: localData,
            synced: false,
            error: "Credenciais do Supabase ausentes no arquivo .env.",
          });
        }

        const { data, error } = await client
          .from("empresa_contratante")
          .select("*")
          .eq("contrato_id", contrato_id)
          .maybeSingle();

        if (error) {
          console.warn(
            `Supabase fetch error for ${contrato_id}, using empty memory template:`,
            error.message,
          );
          const localData =
            inMemoryContratantes.get(contrato_id) || emptyTemplate;
          return res.json({
            success: true,
            data: localData,
            synced: false,
            error: error.message,
          });
        }

        if (!data) {
          // No record yet, return empty template
          const localData =
            inMemoryContratantes.get(contrato_id) || emptyTemplate;
          return res.json({
            success: true,
            data: localData,
            synced: true,
            info: "Empty/New record served",
          });
        }

        // Map lowercase DB columns from PostgreSQL case-insensitive folding
        const mappedContratante = {
          contrato_id: data.contrato_id,
          natureza: data.natureza,
          nome: data.nome,
          area: data.area,
          departamento: data.departamento,
          cnpj: data.cnpj,
          email: data.email,
          telefone: data.telefone,
          gestorResponsavel:
            data.gestor_responsavel !== undefined
              ? data.gestor_responsavel
              : data.gestorResponsavel,
          unidadeAdministrativa:
            data.unidade_administrativa !== undefined
              ? data.unidade_administrativa
              : data.unidadeAdministrativa,
        };

        return res.json({
          success: true,
          data: mappedContratante,
          synced: true,
        });
      } catch (err: any) {
        console.error("GET /api/contratante unexpected error:", err);
        const localData =
          inMemoryContratantes.get(contrato_id) || emptyTemplate;
        return res.json({
          success: true,
          data: localData,
          synced: false,
          error: err.message,
        });
      }
    },
  );

  // POST (Upsert) Empresa Contratante
  router.post(
    "/api/contratante",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      const targetContratoId = req.decodedToken.contrato_id;
      const {
        natureza,
        nome,
        area,
        departamento,
        cnpj,
        email,
        telefone,
        gestorResponsavel,
        unidadeAdministrativa,
      } = req.body || {};

      const payload = {
        contrato_id: targetContratoId,
        natureza,
        nome,
        area,
        departamento,
        cnpj,
        email,
        telefone,
        gestorResponsavel,
        unidadeAdministrativa,
      };

      // Postgres DB Payload mapping camelCase to unquoted lowercase fields
      const dbPayload = {
        contrato_id: targetContratoId,
        natureza,
        nome,
        area,
        departamento,
        cnpj,
        email,
        telefone,
        gestor_responsavel: gestorResponsavel,
        unidade_administrativa: unidadeAdministrativa,
      };

      // Keep memory fallback updated
      inMemoryContratantes.set(targetContratoId, payload);

      try {
        const client = getSupabaseClient(req);
        if (!client) {
          return res.json({
            success: true,
            message:
              "Salvo temporariamente na memória local (Supabase não configurado).",
            data: payload,
            synced: false,
            error: "Credenciais do Supabase ausentes no arquivo .env.",
          });
        }

        const { data, error } = await saveRecord(
          client,
          "empresa_contratante",
          dbPayload,
          { onConflict: "contrato_id", single: false },
        );

        if (error) {
          console.warn(
            "Supabase upsert error, saved in memory fallback:",
            error.message,
          );
          return res.json({
            success: true,
            message:
              "Salvo temporariamente na memória local (Supabase indisponível ou tabela ausente).",
            data: payload,
            synced: false,
            error: error.message,
          });
        }

        const savedItem = data?.[0] || dbPayload;
        const mappedSaved = {
          contrato_id: savedItem.contrato_id,
          natureza: savedItem.natureza,
          nome: savedItem.nome,
          area: savedItem.area,
          departamento: savedItem.departamento,
          cnpj: savedItem.cnpj,
          email: savedItem.email,
          telefone: savedItem.telefone,
          gestorResponsavel:
            savedItem.gestorresponsavel !== undefined
              ? savedItem.gestorresponsavel
              : savedItem.gestorResponsavel,
          unidadeAdministrativa:
            savedItem.unidadeadministrativa !== undefined
              ? savedItem.unidadeadministrativa
              : savedItem.unidadeAdministrativa,
        };

        return res.json({
          success: true,
          message:
            "Cadastro da empresa contratante atualizado no Supabase com sucesso!",
          data: mappedSaved,
          synced: true,
        });
      } catch (err: any) {
        console.error("POST /api/contratante unexpected error:", err);
        return res.json({
          success: true,
          message:
            "Salvo temporariamente na memória local devido a um erro inesperado.",
          data: payload,
          synced: false,
          error: err.message,
        });
      }
    },
  );

  // GET /api/empresas - List all companies for a tenant
  router.get(
    "/api/empresas",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      if (!(await checkPermission(req, "empresas_ler"))) {
        return res
          .status(403)
          .json({ error: "Acesso negado: sem permissão para ler empresas." });
      }
      const contrato_id = req.decodedToken.contrato_id;
      try {
        const client = getSupabaseClient(req);
        if (!client) {
          const localData = inMemoryEmpresas.get(contrato_id) || [];
          return res.json({
            success: true,
            data: localData,
            synced: false,
            error: "Credenciais do Supabase ausentes no arquivo .env.",
          });
        }

        let query = client
          .from("empresas_fornecedores")
          .select("*")
          .eq("contrato_id", contrato_id);

        if (req.decodedToken.empresa_id) {
          query = query.eq("id", req.decodedToken.empresa_id);
        }

        const { data, error } = await query;

        if (error) {
          console.warn(
            `Supabase fetch error for empresas under ${contrato_id}, using memory fallback:`,
            error.message,
          );
          const localData = inMemoryEmpresas.get(contrato_id) || [];
          return res.json({
            success: true,
            data: localData,
            synced: false,
            error: error.message,
          });
        }

        // Map lowercase columns from PostgreSQL case-insensitive folding to frontend camelCase
        const mappedData = (data || []).map((item: any) => ({
          id: item.id || "",
          contrato_id: item.contrato_id || contrato_id,
          nome: item.nome || "",
          cnpj_cpf: item.cnpj_cpf || "",
          tipo:
            item.id && String(item.id).startsWith("GER-")
              ? "GESTORA"
              : item.tipo || "FORNECEDOR",
          emailContato:
            item.email_contato !== undefined && item.email_contato !== null
              ? item.email_contato
              : item.emailContato || "",
          telefone: item.telefone || "",
          status: item.status || "ATIVO",
          totalFaturado:
            item.total_faturado !== undefined && item.total_faturado !== null
              ? Number(item.total_faturado)
              : Number(item.totalFaturado || 0),
          createdAt:
            item.created_at !== undefined ? item.created_at : item.createdAt,
          detalhes: item.detalhes
        }));

        return res.json({ success: true, data: mappedData, synced: true });
      } catch (err: any) {
        console.error("GET /api/empresas unexpected error:", err);
        const localData = inMemoryEmpresas.get(contrato_id) || [];
        return res.json({
          success: true,
          data: localData,
          synced: false,
          error: err.message,
        });
      }
    },
  );

  // ==========================================
  // CUSTOS DE MÃO DE OBRA, ENCARGOS E BDI
  // Movido para src/routes/financeiro.routes.ts (Fase 1 da modularização)
  // ==========================================

  // POST /api/empresas - Create/Update a company
  router.post(
    "/api/empresas",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      if (!(await checkPermission(req, "empresas_criar"))) {
        return res
          .status(403)
          .json({ error: "Acesso negado: sem permissão para criar empresas." });
      }
      const contrato_id = req.decodedToken.contrato_id;
      const empresa = req.body || {};
      const {
        nome,
        cnpj_cpf,
        tipo,
        emailContato,
        telefone,
        status,
        totalFaturado,
        detalhes
      } = empresa;
      const id =
        empresa.id || `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      if (!contrato_id || !nome || !cnpj_cpf) {
        return res
          .status(400)
          .json({
            error: "Campos contrato_id, nome e cnpj_cpf são obrigatórios.",
          });
      }

      const payload = {
        id,
        contrato_id,
        nome,
        cnpj_cpf,
        tipo: tipo || "FORNECEDOR",
        emailContato: emailContato || "",
        telefone: telefone || "",
        status: status || "ATIVO",
        totalFaturado: Number(totalFaturado) || 0,
        createdAt: empresa.createdAt || new Date().toISOString().split("T")[0],
        detalhes: detalhes || {},
      };

      // Postgres DB Payload mapping camelCase properties to unquoted snake_case columns
      const dbPayload = {
        id,
        contrato_id,
        nome,
        cnpj_cpf,
        tipo:
          tipo === "GESTORA" || id.startsWith("GER-")
            ? "CONTRATANTE"
            : tipo || "FORNECEDOR",
        email_contato: emailContato || "",
        telefone: telefone || "",
        status: status || "ATIVO",
        total_faturado: Number(totalFaturado) || 0,
        created_at: empresa.createdAt || new Date().toISOString().split("T")[0],
        detalhes: detalhes || {},
      };

      // Update memory fallback
      const list = inMemoryEmpresas.get(contrato_id) || [];
      const index = list.findIndex((item) => item.id === id);
      if (index >= 0) {
        list[index] = payload;
      } else {
        list.push(payload);
      }
      inMemoryEmpresas.set(contrato_id, list);

      try {
        const client = getSupabaseClient(req);
        if (!client) {
          return res.status(403).json({
            success: false,
            message: "Acesso negado: Supabase não configurado.",
            error: "Credenciais do Supabase ausentes no arquivo .env.",
          });
        }

        const { data, error } = await saveRecord(
          client,
          "empresas_fornecedores",
          dbPayload,
          { onConflict: "id, contrato_id", single: false },
        );

        if (error) {
          console.warn(
            "Supabase upsert companies error, saved in memory fallback:",
            error.message,
          );
          return res.json({
            success: true,
            message:
              "Salvo temporariamente na memória local (Supabase indisponível ou tabela ausente).",
            data: payload,
            synced: false,
            error: error.message,
          });
        }

        const savedItem = data?.[0] || dbPayload;
        const mappedSaved = {
          id: savedItem.id,
          contrato_id: savedItem.contrato_id,
          nome: savedItem.nome,
          cnpj_cpf: savedItem.cnpj_cpf,
          tipo: savedItem.tipo,
          emailContato:
            savedItem.email_contato !== undefined
              ? savedItem.email_contato
              : savedItem.emailContato,
          telefone: savedItem.telefone,
          status: savedItem.status,
          totalFaturado:
            savedItem.total_faturado !== undefined
              ? Number(savedItem.total_faturado)
              : Number(savedItem.totalFaturado || 0),
          createdAt:
            savedItem.created_at !== undefined
              ? savedItem.created_at
              : savedItem.createdAt,
          detalhes: savedItem.detalhes || {}
        };

        return res.json({
          success: true,
          message: "Cadastro de empresa atualizado no Supabase com sucesso!",
          data: mappedSaved,
          synced: true,
        });
      } catch (err: any) {
        console.error("POST /api/empresas unexpected error:", err);
        return res.json({
          success: true,
          message:
            "Salvo temporariamente na memória local devido a um erro inesperado.",
          data: payload,
          synced: false,
          error: err.message,
        });
      }
    },
  );

  // DELETE /api/empresas - Delete a company
  router.delete(
    "/api/empresas",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      const contrato_id = req.decodedToken.contrato_id;
      const id = req.query.id as string;

      if (!id || !contrato_id) {
        return res
          .status(400)
          .json({ error: "Parâmetros id e contrato_id são obrigatórios." });
      }

      // Update memory fallback
      const list = inMemoryEmpresas.get(contrato_id) || [];
      const updatedList = list.filter((item) => item.id !== id);
      inMemoryEmpresas.set(contrato_id, updatedList);

      try {
        const client = getSupabaseClient(req);
        if (!client) {
          return res.json({
            success: true,
            message: "Removido da memória local (Supabase não configurado).",
            synced: false,
            error: "Credenciais do Supabase ausentes no arquivo .env.",
          });
        }

        const { error } = await client
          .from("empresas_fornecedores")
          .delete()
          .eq("id", id)
          .eq("contrato_id", contrato_id);

        if (error) {
          console.warn("Supabase delete companies error:", error.message);
          return res.json({
            success: true,
            message:
              "Removido da memória local (Supabase indisponível ou tabela ausente).",
            synced: false,
            error: error.message,
          });
        }

        return res.json({
          success: true,
          message: "Empresa excluída do Supabase com sucesso!",
          synced: true,
        });
      } catch (err: any) {
        console.error("DELETE /api/empresas unexpected error:", err);
        return res.json({
          success: true,
          message: "Removido da memória local devido a um erro inesperado.",
          synced: false,
          error: err.message,
        });
      }
    },
  );

export default router;


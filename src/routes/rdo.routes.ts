import { Router } from "express";
import { getSupabaseClient, saveRecord } from "../lib/server.lib";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";

const app = Router();

  // GET /api/rdos
  app.get(
    "/api/rdos",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { ordem_servico_id, projeto_id } = req.query;
        let query = client.from("rdos").select("*");

        if (ordem_servico_id) {
          query = query.eq("ordem_servico_id", ordem_servico_id);
        } else if (projeto_id) {
          query = query.eq("projeto_id", projeto_id);
        }

        const { data, error } = await query.order("created_at", {
          ascending: false,
        });
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // POST /api/rdos
  app.post(
    "/api/rdos",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const rdoData = req.body;
        const tenantId = req.decodedToken?.contrato_id;
        const ano = new Date(rdoData.data_rdo || new Date())
          .getFullYear()
          .toString()
          .slice(-2);

        const { data: countData } = await client
          .from("rdos")
          .select("id", { count: "exact" })
          .eq("tenant_id", tenantId);
        const seq = ((countData?.length || 0) + 1).toString().padStart(3, "0");
        const numero_rdo = `RDO-${seq}-${ano}`;

        const payload = {
          tenant_id: tenantId,
          projeto_id: rdoData.projeto_id,
          ordem_servico_id: rdoData.ordem_servico_id,
          numero_rdo: numero_rdo,
          data_rdo: rdoData.data_rdo,
          clima_manha: rdoData.clima_manha,
          clima_tarde: rdoData.clima_tarde,
          status: "Rascunho",
        };

        const { data, error } = await client
          .from("rdos")
          .insert(payload)
          .select()
          .single();
        if (error) return res.status(500).json({ error: error.message });

        // Salvar os itens do RDO
        if (rdoData.itens && rdoData.itens.length > 0) {
          const itensPayload = rdoData.itens.map((item: any) => ({
            tenant_id: tenantId,
            rdo_id: data.id,
            item_eap_id: item.item_eap_id,
            qtd_medida: item.qtd_medida_hoje || 0,
            valor_unitario_contrato: 0,
            valor_total_dia: 0,
          }));
          const { error: itemsError } = await client
            .from("rdo_items")
            .insert(itensPayload);
          if (itemsError)
            console.error("Erro ao salvar rdo_items:", itemsError);
        }

        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

export default app;

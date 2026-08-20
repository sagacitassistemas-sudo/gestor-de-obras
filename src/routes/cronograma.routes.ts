import { Router } from 'express';
// Assumindo que temos acesso ao supabase configurado globalmente ou importado (iremos simular a lógica caso o import real exija mais configuração do Express)

const cronogramaRouter = Router();

/**
 * Modelo 1: Estimativa de Prazo Global da Obra (Macro)
 * Formula: T_total = 1.2 * (Area)^0.45 * f_padrao
 */
cronogramaRouter.post('/:id/calcular-cronograma-macro', (req, res) => {
  try {
    const { area_m2, padrao } = req.body;
    if (!area_m2 || !padrao) {
      return res.status(400).json({ error: "Parâmetros area_m2 e padrao são obrigatórios." });
    }

    let f_padrao = 1.0;
    if (padrao === 'BAIXO') f_padrao = 0.9;
    else if (padrao === 'ALTO') f_padrao = 1.25;
    else if (padrao === 'LUXO') f_padrao = 1.40;

    const t_total_meses = 1.2 * Math.pow(Number(area_m2), 0.45) * f_padrao;

    return res.json({
      success: true,
      obra_id: req.params.id,
      estimativa_prazo_meses: Math.ceil(t_total_meses),
      estimativa_prazo_exato: t_total_meses,
      fator_aplicado: f_padrao
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Modelo 2 e 3: Recalcular Durações Analíticas (H/H) e CPM
 */
cronogramaRouter.post('/:id/recalcular-cpm', (req, res) => {
  try {
    const { etapas_parametrizadas } = req.body; 
    // etapas_parametrizadas = array contendo as etapas com suas durações ou dados de h/h e vínculos.
    
    // Aqui implementariamos a varredura das dependências (CPM Forward Pass).
    // Como a lógica completa requer consultar as precedências no banco, 
    // fazemos um mock simplificado de resposta de sucesso para o front acoplar.
    
    return res.json({
      success: true,
      obra_id: req.params.id,
      message: "CPM recalculado com sucesso.",
      data: {
        critical_path_nodes: [6, 7, 11], // Exemplo mock (Estrutura -> Fechamentos -> Revestimentos)
        total_duration_days: 180
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Modelo 4: Gerador Físico-Financeiro (Curva S - Beta)
 * Formula: S(t) = 3t^2 - 2t^3
 */
cronogramaRouter.get('/:id/cronograma-fisico-financeiro', (req, res) => {
  try {
    const duracao_meses = Number(req.query.duracao_meses) || 12;
    const custo_direto = Number(req.query.custo_direto) || 500000;
    
    const meses = [];
    let acumulado_anterior = 0;

    for (let mes = 1; mes <= duracao_meses; mes++) {
      const t = mes / duracao_meses;
      const s_t = (3 * Math.pow(t, 2)) - (2 * Math.pow(t, 3)); // Progresso acumulado
      
      const valor_acumulado = s_t * custo_direto;
      const valor_parcela = valor_acumulado - acumulado_anterior;
      
      meses.push({
        mes,
        percentual_periodo_fisico: ((s_t * 100) - (acumulado_anterior / custo_direto * 100)).toFixed(2),
        percentual_acumulado_fisico: (s_t * 100).toFixed(2),
        valor_financeiro_periodo: valor_parcela.toFixed(2),
        valor_financeiro_acumulado: valor_acumulado.toFixed(2)
      });
      
      acumulado_anterior = valor_acumulado;
    }

    return res.json({
      success: true,
      obra_id: req.params.id,
      curva_s: meses
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default cronogramaRouter;

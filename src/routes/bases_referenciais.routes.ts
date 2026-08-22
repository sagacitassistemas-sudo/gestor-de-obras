import { Router } from "express";
import { getSupabaseClient } from "../lib/server.lib";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import multer from 'multer';
import ExcelJS from 'exceljs';

const upload = multer({ storage: multer.memoryStorage() });
const app = Router();

app.post('/import-insumos', verifyFirebaseJWT, upload.single('file'), async (req: any, res: any) => {
  try {
    const contrato_id = req.decodedToken?.contrato_id;
    if (!contrato_id) {
      return res.status(401).json({ message: "Sessão inválida. Contrato não identificado." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }

    const { orgao, mesReferencia } = req.body;
    if (!orgao || !mesReferencia) {
      return res.status(400).json({ message: "Órgão e Mês de Referência são obrigatórios." });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    
    if (workbook.worksheets.length === 0) {
      return res.status(400).json({ message: "O arquivo Excel está vazio." });
    }

    const worksheet = workbook.worksheets[0];
    const insumos: any[] = [];
    let currentCategory = 'Desconhecida';

    let foundMaoDeObra = 0;
    let foundMaterial = 0;
    let foundEquipamento = 0;

    for (let i = 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      
      // Procura linha de categoria "Categoria: Mão-de-obra"
      const text1 = String(row.values[1] || '').trim();
      const text2 = String(row.values[2] || '').trim();
      
      const checkCategory = (text: string) => {
        if (text.startsWith('Categoria:')) {
           const catName = text.replace('Categoria:', '').trim();
           if (catName.toLowerCase().includes('obra')) {
               return 'Mão-de-obra';
           } else if (catName.toLowerCase().includes('material')) {
               return 'Material';
           } else if (catName.toLowerCase().includes('equipamento')) {
               return 'Equipamento';
           }
           return catName;
        }
        return null;
      };

      const newCat1 = checkCategory(text1);
      const newCat2 = checkCategory(text2);
      if (newCat1) currentCategory = newCat1;
      else if (newCat2) currentCategory = newCat2;

      // Lê as colunas assumindo o padrão:
      // values[1] = Código
      // values[2] = Descrição
      // values[3] = Unidade
      // values[4] = Preço
      
      const codigo = String(row.values[1] || '').trim();
      const descricao = String(row.values[2] || '').trim();
      const unidade = String(row.values[3] || '').trim();
      const precoRaw = row.values[4]; // pode ser número ou string

      // Filtra os que são validamente insumos (não é cabeçalho e tem preço numérico)
      // Agrupadores (ex: '0101 MAO DE OBRA SALARIOS) não tem Unidade válida e Preço é vazio.
      if (codigo && descricao && codigo !== 'Código' && unidade && unidade !== 'Und.') {
         // O preço pode vir formatado com R$ ou ser diretamente um Number
         let preco = 0;
         if (typeof precoRaw === 'number') {
           preco = precoRaw;
         } else if (typeof precoRaw === 'string') {
           const parsed = parseFloat(precoRaw.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
           if (!isNaN(parsed)) preco = parsed;
         }
         
         // Se o preço for > 0 (alguns insumos podem ser 0, mas pelo menos teremos validado a conversão)
         // A regra de negócio principal é que o item tem um Código (ex: '010101).
         if (codigo.match(/^'?[0-9]+$/)) { // Códigos normais tipo '010101 ou 010101
            insumos.push({
               contrato_id,
               orgao,
               mes_ano_ref: mesReferencia,
               categoria: currentCategory,
               codigo: codigo.replace(/^'/, ''), // Tira a aspa simples que vem do excel
               descricao,
               unidade,
               preco
            });

            if (currentCategory === 'Mão-de-obra') foundMaoDeObra++;
            else if (currentCategory === 'Material') foundMaterial++;
            else if (currentCategory === 'Equipamento') foundEquipamento++;
         }
      }
    }

    if (insumos.length === 0) {
      return res.status(400).json({ message: "Nenhum insumo válido foi encontrado no arquivo. Verifique o formato." });
    }

    // Salva no banco de dados (batch upsert)
    // Supabase limita batches muito grandes, então podemos quebrar em chunks de 1000
    const client = getSupabaseClient(req);
    const chunkSize = 1000;
    
    for (let i = 0; i < insumos.length; i += chunkSize) {
      const chunk = insumos.slice(i, i + chunkSize);
      const { error } = await client
        .from('ref_bases_insumos')
        .upsert(chunk, {
           onConflict: 'contrato_id, orgao, mes_ano_ref, codigo'
        });
        
      if (error) {
        console.error("Erro ao salvar lote de insumos:", error);
        return res.status(500).json({ message: "Erro no banco de dados (Supabase) ao salvar lote.", error: error.message || error.details || JSON.stringify(error) });
      }
    }

    res.json({
      success: true,
      message: `${insumos.length} insumos importados com sucesso.`,
      resumo: {
         totalMaoDeObra: foundMaoDeObra,
         totalMaterial: foundMaterial,
         totalEquipamento: foundEquipamento
      }
    });

  } catch (error: any) {
    console.error("[Importação Bases] Erro:", error);
    res.status(500).json({ message: "Erro ao processar arquivo.", error: error.message });
  }
});

// Importação de Serviços
app.post('/import-servicos', verifyFirebaseJWT, upload.single('file'), async (req: any, res: any) => {
  try {
    const contrato_id = req.decodedToken?.contrato_id;
    if (!contrato_id) {
      return res.status(401).json({ message: "Sessão inválida. Contrato não identificado." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }

    const { orgao, mesReferencia } = req.body;
    if (!orgao || !mesReferencia) {
      return res.status(400).json({ message: "Órgão e Mês de Referência são obrigatórios." });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    
    if (workbook.worksheets.length === 0) {
      return res.status(400).json({ message: "O arquivo Excel está vazio." });
    }

    const worksheet = workbook.worksheets[0];
    const servicos: any[] = [];
    let addedCount = 0;

    for (let i = 13; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      
      // Cabeçalho da planilha de serviços (Linha 12):
      // values[1] = Item
      // values[2] = Fonte/Código
      // values[3] = Especificação do Serviço
      // values[4] = Und.
      // values[5] = Quant.
      // values[6] = Preço Unitário
      // values[7] = Preço Total

      const itemRaw = String(row.values[1] || '').trim();
      const codigoFonte = String(row.values[2] || '').trim();
      const descricao = String(row.values[3] || '').trim();
      const unidade = String(row.values[4] || '').trim();
      const precoRaw = row.values[6]; // Preço Unitário

      // Limpa aspas do item caso existam (ex: '0101)
      const itemClean = itemRaw.replace(/^'/, '');

      // Uma linha de Serviço na base pode ser:
      // 1. Um grupo/título: tem Item e Descrição, mas não tem Código Fonte nem Und.
      // 2. Um serviço folha: tem Item, Código Fonte, Descrição, Und, Preço.
      // Então a regra básica é ter um Item e uma Descrição.
      if (itemClean && descricao) {
          let preco = 0;
          if (typeof precoRaw === 'number') {
            preco = precoRaw;
          } else if (typeof precoRaw === 'string') {
            const parsed = parseFloat(precoRaw.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
            if (!isNaN(parsed)) preco = parsed;
          }

          servicos.push({
             contrato_id,
             orgao,
             mes_ano_ref: mesReferencia,
             item: itemClean,
             codigo_fonte: codigoFonte || null, // nulo para grupos
             descricao,
             unidade: unidade || null, // nulo para grupos
             preco_unitario: preco
          });
          addedCount++;
      }
    }

    if (servicos.length === 0) {
      return res.status(400).json({ message: "Nenhum serviço válido foi encontrado no arquivo. Verifique o formato." });
    }

    // Batch upsert (chunk 1000)
    const client = getSupabaseClient(req);
    const chunkSize = 1000;
    
    for (let i = 0; i < servicos.length; i += chunkSize) {
      const chunk = servicos.slice(i, i + chunkSize);
      const { error } = await client
        .from('ref_bases_servicos')
        .upsert(chunk, {
           onConflict: 'contrato_id, orgao, mes_ano_ref, item'
        });
        
      if (error) {
        console.error("Erro ao salvar lote de serviços:", error);
        return res.status(500).json({ message: "Erro no banco de dados (Supabase) ao salvar serviços.", error: error.message || error.details || JSON.stringify(error) });
      }
    }

    res.json({
      success: true,
      message: `${servicos.length} serviços importados com sucesso.`,
      resumo: {
         totalServicos: addedCount
      }
    });

  } catch (error: any) {
    console.error("[Importação Serviços] Erro:", error);
    res.status(500).json({ message: "Erro ao processar arquivo.", error: error.message });
  }
});

// Lista lotes de uma base referencial
app.get('/lotes', verifyFirebaseJWT, async (req: any, res: any) => {
  try {
    const contrato_id = req.decodedToken?.contrato_id;
    if (!contrato_id) {
      return res.status(401).json({ message: "Sessão inválida. Contrato não identificado." });
    }

    const client = getSupabaseClient(req);
    
    // Agrupa por orgao e mes_ano_ref para exibir os lotes cadastrados
    // O ideal seria usar uma query rpc, ou trazer distinct.
    // Usaremos uma contagem básica agrupada (não suportado nativamente pelo ORM, usaremos rpc ou max se tivermos)
    // Para simplificar, buscamos todos e agrupamos no backend
    const { data, error } = await client
      .from('ref_bases_insumos')
      .select('orgao, mes_ano_ref, categoria, preco')
      .eq('contrato_id', contrato_id);

    if (error) throw error;

    const lotesMap: Record<string, any> = {};
    
    data?.forEach(item => {
       const key = `${item.orgao}_${item.mes_ano_ref}`;
       if (!lotesMap[key]) {
          lotesMap[key] = {
             orgao: item.orgao,
             mes_ano_ref: item.mes_ano_ref,
             qtdInsumos: 0
          };
       }
       lotesMap[key].qtdInsumos++;
    });

    res.json({
      success: true,
      data: Object.values(lotesMap)
    });
    
  } catch (error: any) {
    console.error("Erro ao listar bases:", error.message);
    res.status(500).json({ message: "Erro ao listar bases.", error: error.message });
  }
});

// Lista insumos importados de uma base
app.get('/insumos', verifyFirebaseJWT, async (req: any, res: any) => {
  try {
    const contrato_id = req.decodedToken?.contrato_id;
    if (!contrato_id) {
      return res.status(401).json({ message: "Sessão inválida. Contrato não identificado." });
    }

    const { orgao, mes_ano_ref, categoria } = req.query;

    const client = getSupabaseClient(req);
    let query = client.from('ref_bases_insumos')
      .select('*')
      .eq('contrato_id', contrato_id);

    if (orgao) query = query.eq('orgao', orgao);
    if (mes_ano_ref) query = query.eq('mes_ano_ref', mes_ano_ref);
    if (categoria) query = query.eq('categoria', categoria);
    
    // Limits the output for performance in the UI
    query = query.limit(500);

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data
    });
    
  } catch (error: any) {
    console.error("Erro ao listar insumos:", error.message);
    res.status(500).json({ message: "Erro ao listar insumos.", error: error.message });
  }
});

// Lista serviços importados de uma base
app.get('/servicos', verifyFirebaseJWT, async (req: any, res: any) => {
  try {
    const contrato_id = req.decodedToken?.contrato_id;
    if (!contrato_id) {
      return res.status(401).json({ message: "Sessão inválida. Contrato não identificado." });
    }

    const { orgao, mes_ano_ref } = req.query;

    const client = getSupabaseClient(req);
    let query = client.from('ref_bases_servicos')
      .select('*')
      .eq('contrato_id', contrato_id);

    if (orgao) query = query.eq('orgao', orgao);
    if (mes_ano_ref) query = query.eq('mes_ano_ref', mes_ano_ref);
    
    // Limits the output for performance in the UI
    query = query.limit(500);

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data
    });
    
  } catch (error: any) {
    console.error("Erro ao listar serviços:", error.message);
    res.status(500).json({ message: "Erro ao listar serviços.", error: error.message });
  }
});

export default app;

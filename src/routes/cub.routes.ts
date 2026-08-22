import { Router } from "express";
import { getSupabaseClient } from "../lib/server.lib";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { getOrSetCache } from "../services/cache.service";
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { PDFParse } from 'pdf-parse';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const app = Router();

app.get('/bases', verifyFirebaseJWT, async (req: any, res: any) => {
  try {
    const contrato_id = req.decodedToken?.contrato_id;
    if (!contrato_id) {
      return res.status(401).json({ message: "Sessão inválida. Contrato não identificado." });
    }

    const client = getSupabaseClient(req);
    const cacheKey = `cub_bases_${contrato_id}`;
    
    const bases = await getOrSetCache(cacheKey, async () => {
      const { data, error } = await client
        .from('ref_cub_bases')
        .select('id, uf, sinduscon_nome, mes_referencia, dados_json, atualizado_em')
        .eq('contrato_id', contrato_id)
        .order('atualizado_em', { ascending: false });

      if (error) throw error;
      
      return data.map(base => ({
        ...base,
        status: 'ATUALIZADO',
        projetos: 10
      }));
    }, 14400); // 4 horas de cache

    res.json({ bases });
  } catch (error: any) {
    console.error("Erro ao listar bases CUB:", error.message);
    res.status(500).json({ message: "Erro ao listar bases CUB", error: error.message });
  }
});

app.post('/scrape', verifyFirebaseJWT, async (req: any, res: any) => {
  try {
    const { uf, sindusconUrl } = req.body;
    
    if (uf !== 'ES') {
      return res.status(400).json({ message: "No momento, apenas o Sinduscon-ES possui rotina automatizada." });
    }

    const url = sindusconUrl || "https://www.sinduscon-es.com.br/v2/cgi-bin/cub_detalhe.asp?menu2=23";
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const htmlUtf8 = iconv.decode(Buffer.from(response.data), 'iso-8859-1');
    const $ = cheerio.load(htmlUtf8);
    
    const cubData: any[] = [];
    
    $('table').each((i, table) => {
      const rows = $(table).find('tr');
      rows.each((j, row) => {
        const cols: string[] = [];
        $(row).find('td, th').each((k, cell) => {
          cols.push($(cell).text().trim());
        });
        
        if (cols.length > 0 && cols.some(c => c.includes('R-1') || c.includes('R-8') || c.includes('PP-4'))) {
           if (cols.length >= 4) {
             const tipo = cols[0];
             const parseCurrency = (val: string) => {
               if (!val || val === '-') return null;
               return parseFloat(val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
             };
             
             cubData.push({
               tipo,
               baixo: parseCurrency(cols[1]),
               normal: parseCurrency(cols[2]),
               alto: parseCurrency(cols[3])
             });
           }
        }
      });
    });

    const uniqueData = Array.from(new Map(cubData.map(item => [item.tipo, item])).values());

    const mesReferenciaRaw = $('html').text().match(/(\w+)\/(\d{4})/);
    let mesRef = '07/2026';
    if(mesReferenciaRaw && mesReferenciaRaw.length >= 3) {
       mesRef = `${mesReferenciaRaw[1]}/${mesReferenciaRaw[2]}`;
    }

    res.json({
      success: true,
      data: {
        uf: 'ES',
        sinduscon: 'Sinduscon-ES',
        mesReferencia: mesRef,
        valores: uniqueData
      }
    });

  } catch (error: any) {
    console.error("Erro na raspagem do CUB:", error.message);
    res.status(500).json({ message: "Erro ao processar integração CUB", error: error.message });
  }
});

app.post('/import-pdf', verifyFirebaseJWT, upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }

    const { uf } = req.body;
    
    const parser = new PDFParse({ data: req.file.buffer });
    const result = await parser.getText();
    const text = result.text;
    await parser.destroy();

    // Acha todas as ocorrências da linha TOTAL seguidas de até 4 valores.
    const regexTotal = /TOTAL\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)(?:\s+([\d.,]+))?/g;
    const matches = [...text.matchAll(regexTotal)];

    const parseCurrency = (val: string) => {
      if (!val || val === '-') return null;
      return parseFloat(val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
    };

    const valores = [];

    if (matches.length >= 5) {
      const baixoR1 = parseCurrency(matches[0][1]);
      const baixoPP4 = parseCurrency(matches[0][2]);
      const baixoR8 = parseCurrency(matches[0][3]);
      const baixoPIS = parseCurrency(matches[0][4] || '');

      const normalR1 = parseCurrency(matches[1][1]);
      const normalPP4 = parseCurrency(matches[1][2]);
      const normalR8 = parseCurrency(matches[1][3]);
      const normalR16 = parseCurrency(matches[1][4] || '');

      const altoR1 = parseCurrency(matches[2][1]);
      const altoR8 = parseCurrency(matches[2][2]);
      const altoR16 = parseCurrency(matches[2][3] || '');

      // Se há apenas 5 matches, o bloco Representativo não foi pego pelo regex.
      const offset = matches.length === 5 ? 3 : 4;
      
      const normalCAL8 = parseCurrency(matches[offset][1]);
      const normalCSL8 = parseCurrency(matches[offset][2]);
      const normalCSL16 = parseCurrency(matches[offset][3] || '');

      const altoCAL8 = parseCurrency(matches[offset + 1][1]);
      const altoCSL8 = parseCurrency(matches[offset + 1][2]);
      const altoCSL16 = parseCurrency(matches[offset + 1][3] || '');

      const matchRP1Q = matches[6] ? parseCurrency(matches[6][1]) : null;
      const matchGI = matches[6] ? parseCurrency(matches[6][2] || '') : null;

      valores.push({ tipo: 'R-1', baixo: baixoR1, normal: normalR1, alto: altoR1 });
      valores.push({ tipo: 'PP-4', baixo: baixoPP4, normal: normalPP4, alto: null });
      valores.push({ tipo: 'R-8', baixo: baixoR8, normal: normalR8, alto: altoR8 });
      valores.push({ tipo: 'R-16', baixo: null, normal: normalR16, alto: altoR16 });
      valores.push({ tipo: 'PIS', baixo: baixoPIS, normal: null, alto: null });
      valores.push({ tipo: 'CAL-8', baixo: null, normal: normalCAL8, alto: altoCAL8 });
      valores.push({ tipo: 'CSL-8', baixo: null, normal: normalCSL8, alto: altoCSL8 });
      valores.push({ tipo: 'CSL-16', baixo: null, normal: normalCSL16, alto: altoCSL16 });
      if (matchGI) valores.push({ tipo: 'GI', baixo: null, normal: matchGI, alto: null });
      if (matchRP1Q) valores.push({ tipo: 'RP1Q', baixo: matchRP1Q, normal: null, alto: null });
    } else {
      return res.status(400).json({ message: "Formato do PDF não reconhecido como tabela CBIC." });
    }

    const mesReferenciaRaw = text.match(/([A-ZÇ]+)\/(\d{4})/i);
    let mesRef = '07/2026';
    if(mesReferenciaRaw && mesReferenciaRaw.length >= 3) {
      const mesAbrev = mesReferenciaRaw[1].substring(0, 3).toUpperCase();
      const mapaMeses: any = { 'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12' };
      mesRef = `${mapaMeses[mesAbrev] || '07'}/${mesReferenciaRaw[2]}`;
    }

    res.json({
      success: true,
      data: {
        uf: uf || 'ES',
        sinduscon: `Sinduscon-${uf || 'ES'}`,
        mesReferencia: mesRef,
        valores
      }
    });

  } catch (error: any) {
    console.error("[CUB Import PDF] Erro:", error);
    res.status(500).json({ message: "Erro ao processar PDF", error: error.message });
  }
});

app.post('/save', verifyFirebaseJWT, async (req: any, res: any) => {
  try {
    const { uf, sinduscon, mesReferencia, valores } = req.body;
    const contrato_id = req.decodedToken?.contrato_id;
    
    if (!contrato_id) {
      return res.status(401).json({ message: "Sessão inválida. Contrato não identificado." });
    }

    if (!uf || !mesReferencia || !valores) {
      return res.status(400).json({ message: "Dados incompletos para salvar a base CUB." });
    }

    const client = getSupabaseClient(req);
    const { data, error } = await client
      .from('ref_cub_bases')
      .upsert(
        {
          contrato_id,
          uf,
          sinduscon_nome: sinduscon || `Sinduscon-${uf}`,
          mes_referencia: mesReferencia,
          dados_json: valores,
          atualizado_em: new Date().toISOString()
        },
        {
          onConflict: 'contrato_id, uf, mes_referencia'
        }
      )
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Erro ao salvar base CUB:", error.message);
    res.status(500).json({ message: "Erro ao salvar base CUB no banco de dados.", error: error.message });
  }
});


export default app;

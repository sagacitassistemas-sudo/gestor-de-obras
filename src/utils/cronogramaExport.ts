import ExcelJS from 'exceljs';
import { Builder, parseStringPromise } from 'xml2js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T12:00:00');
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

function toISODate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T08:00:00');
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

// ─── XLSX Export ─────────────────────────────────────────────────────────────

export async function generateXlsxBuffer(items: any[], projectName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gestor de Obras';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Cronograma');

  sheet.columns = [
    { header: 'EAP',                   key: 'eap',          width: 16  },
    { header: 'Descrição do Serviço',  key: 'desc',         width: 50  },
    { header: 'Início',                key: 'inicio',       width: 14  },
    { header: 'Término',               key: 'fim',          width: 14  },
    { header: 'Duração (d)',           key: 'duracao',      width: 12  },
    { header: 'Unidade',               key: 'unidade',      width: 10  },
    { header: 'Contratado (R$)',       key: 'contratado',   width: 20, style: { numFmt: '#,##0.00' } },
    { header: '% Executado',           key: 'percentual',   width: 14, style: { numFmt: '0.00%' } },
  ];

  // Cabeçalho estilizado
  const headerRow = sheet.getRow(1);
  headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005DAA' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  items.forEach((item, idx) => {
    const isAnalitico = !!item.e_analitico;
    const row = sheet.addRow({
      eap:        item.eap_codigo,
      desc:       item.descricao_servico,
      inicio:     formatDateBR(item.data_inicio ?? item.data_execucao),
      fim:        formatDateBR(item.data_fim),
      duracao:    item.duracao_dias || 1,
      unidade:    item.unidade_medida || '-',
      contratado: item.valor_total_contratado || 0,
      percentual: (item.percentual_executado_financeiro || 0) / 100,
    });

    // Sintéticos em negrito + fundo suave
    if (!isAnalitico) {
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FA' } };
    }

    // Borda em todas as células
    row.eachCell(cell => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      };
    });
  });

  // Auto-fit estimado já definido via `width` acima
  sheet.getColumn('eap').alignment = { horizontal: 'center' };
  sheet.getColumn('inicio').alignment = { horizontal: 'center' };
  sheet.getColumn('fim').alignment = { horizontal: 'center' };
  sheet.getColumn('duracao').alignment = { horizontal: 'center' };
  sheet.getColumn('percentual').numFmt = '0.00%';

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// ─── XML / MS Project Export ─────────────────────────────────────────────────

/**
 * Gera XML compatível com Microsoft Project (formato MSPDI — MS Project XML).
 * Pode ser aberto diretamente no MS Project, Libre ProjectLibre e similares.
 */
export function generateMppXml(items: any[], projectName: string): string {
  const tasks = items.map((item, index) => {
    const uid = index + 1;
    return {
      UID:      uid,
      ID:       uid,
      Name:     item.descricao_servico || '',
      WBS:      item.eap_codigo || '',
      Duration: `PT${(item.duracao_dias || 1) * 8}H0M0S`,  // horas de trabalho
      Start:    toISODate(item.data_inicio ?? item.data_execucao) || '',
      Finish:   toISODate(item.data_fim) || '',
      Summary:  item.e_analitico ? 0 : 1,
      PercentComplete: Math.round(item.percentual_executado_financeiro || 0),
    };
  });

  const xmlObj = {
    Project: {
      $: {
        'xmlns': 'http://schemas.microsoft.com/project',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      },
      Title:    projectName,
      DurationFormat: 7, // dias
      Tasks: {
        Task: tasks,
      },
    },
  };

  const builder = new Builder({
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
    xmldec: { version: '1.0', encoding: 'UTF-8' },
  });

  return builder.buildObject(xmlObj);
}

// ─── XML Import ───────────────────────────────────────────────────────────────

export async function parseMppXml(xmlString: string) {
  try {
    const result = await parseStringPromise(xmlString);
    if (!result.Project || !result.Project.Tasks || !result.Project.Tasks[0].Task) {
      throw new Error('Formato XML inválido. Esperado formato padrão Microsoft Project.');
    }

    const tasks = result.Project.Tasks[0].Task;
    return tasks.map((t: any) => ({
      eap_codigo:       t.WBS?.[0] || '',
      descricao_servico: t.Name?.[0] || '',
      data_execucao:    t.Start?.[0] ? t.Start[0].substring(0, 10) : null,
      data_inicio:      t.Start?.[0] ? t.Start[0].substring(0, 10) : null,
      data_fim:         t.Finish?.[0] ? t.Finish[0].substring(0, 10) : null,
      duracao_dias:     t.Duration?.[0]
        ? Math.max(1, Math.round(parseFloat(t.Duration[0].replace(/[^0-9.]/g, '')) / 8))
        : 1,
      e_analitico: t.Summary?.[0] === '0',
    }));
  } catch (err) {
    throw err;
  }
}

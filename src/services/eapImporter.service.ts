export interface ParsedEapItem {
  id?: string;
  eap_codigo: string;
  eap_pai_codigo: string | null;
  descricao_servico: string;
  unidade_medida: string | null;
  preco_unitario: number;
  quantidade_contratada: number;
  valor_total_contratado: number;
  valor_desembolsado?: number;
  e_analitico: boolean;
  ordem: number;
  data_inicio?: string;
  data_fim?: string;
  duracao_dias?: number;
  predecessores?: string[];
  percentual_executado_financeiro?: number;
  campos_adicionais?: Record<string, any>;
  action?: 'NEW' | 'UPDATE';
}

export interface SchemaAnalysisResult {
  mappedColumns: string[];
  newCustomColumns: string[];
  standardDbColumns: string[];
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  itemCode?: string;
}

export interface SimulationResult {
  valid: boolean;
  items: ParsedEapItem[];
  issues: ValidationIssue[];
  metrics: {
    totalItems: number;
    syntheticCount: number;
    analyticCount: number;
    totalContractValue: number;
    newItemsCount: number;
    updateItemsCount: number;
  };
  schemaAnalysis: SchemaAnalysisResult;
}

const STANDARD_DB_COLUMNS = [
  'id',
  'projeto_id',
  'eap_codigo',
  'eap_pai_codigo',
  'descricao_servico',
  'unidade_medida',
  'preco_unitario',
  'quantidade_contratada',
  'valor_total_contratado',
  'valor_desembolsado',
  'e_analitico',
  'ordem',
  'created_at'
];

/**
  * Helper to parse Brazilian or standard numeric strings to number
  */
export function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  if (!str) return 0;
  // Remove currency prefix like "R$", spaces, etc.
  const cleanStr = str.replace(/[^0-9.,-]/g, '').trim();
  if (!cleanStr) return 0;

  // Handle Brazilian formatting: 1.234,56 -> 1234.56
  if (cleanStr.includes(',') && cleanStr.includes('.')) {
    const cleaned = cleanStr.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (cleanStr.includes(',')) {
    const parsed = parseFloat(cleanStr.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
  * Helper to compare two EAP codes in natural hierarchical numerical order
  * e.g., "1" < "1.1" < "1.1.1" < "1.2" < "1.10" < "2"
  */
export function compareEapCodes(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const cleanA = String(a).trim();
  const cleanB = String(b).trim();

  const partsA = cleanA.split('.');
  const partsB = cleanB.split('.');
  const minLen = Math.min(partsA.length, partsB.length);

  for (let i = 0; i < minLen; i++) {
    const numA = parseInt(partsA[i], 10);
    const numB = parseInt(partsB[i], 10);

    const isPureNumA = !isNaN(numA) && String(numA) === partsA[i];
    const isPureNumB = !isNaN(numB) && String(numB) === partsB[i];

    if (isPureNumA && isPureNumB) {
      if (numA !== numB) return numA - numB;
    } else {
      const cmp = partsA[i].localeCompare(partsB[i], undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }

  return partsA.length - partsB.length;
}

/**
  * Helper to derive parent code e.g. "1.2.3" -> "1.2", "1.2" -> "1", "1" -> null
  */
export function deriveParentCode(codigo: string): string | null {
  if (!codigo) return null;
  const parts = codigo.trim().split('.');
  if (parts.length <= 1) return null;
  return parts.slice(0, parts.length - 1).join('.');
}

/**
  * Desambigua códigos EAP duplicados gerando sufixos únicos e remapeando a hierarquia pai-filho
  */
export function disambiguateDuplicateCodes(rawItems: ParsedEapItem[]): ParsedEapItem[] {
  const codeCounts = new Map<string, number>();
  const parentRemap = new Map<string, string>();

  return rawItems.map((item, idx) => {
    const origCode = item.eap_codigo;
    const count = (codeCounts.get(origCode) || 0) + 1;
    codeCounts.set(origCode, count);

    let finalCode = origCode;
    if (count > 1) {
      finalCode = `${origCode}_${count}`;
      parentRemap.set(origCode, finalCode);
    }

    // Remap parent if parent was previously remapped
    let finalParent = item.eap_pai_codigo;
    if (finalParent && parentRemap.has(finalParent)) {
      finalParent = parentRemap.get(finalParent) || finalParent;
    }

    return {
      ...item,
      eap_codigo: finalCode,
      eap_pai_codigo: finalParent,
      ordem: idx + 1
    };
  });
}

/**
  * ETAPA 1: Leitura (.md)
  * Realiza o parsing de tabelas Markdown e extração de etapas EAP
  */
export function parseEapMarkdown(mdContent: string): { items: ParsedEapItem[]; rawHeaders: string[] } {
  if (!mdContent || !mdContent.trim()) {
    return { items: [], rawHeaders: [] };
  }

  const lines = mdContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const tableLines = lines.filter(l => l.startsWith('|') && l.endsWith('|'));

  let result: { items: ParsedEapItem[]; rawHeaders: string[] };

  if (tableLines.length >= 2) {
    result = parseMarkdownTable(tableLines);
  } else {
    result = parseMarkdownList(lines);
  }

  return {
    items: disambiguateDuplicateCodes(result.items),
    rawHeaders: result.rawHeaders
  };
}

function parseMarkdownTable(tableLines: string[]): { items: ParsedEapItem[]; rawHeaders: string[] } {
  // First line is header
  const headerLine = tableLines[0];
  const rawHeaders = headerLine
    .split('|')
    .slice(1, -1)
    .map(h => h.trim());

  // Second line is separator (|---|---|...), skip it
  const dataLines = tableLines.slice(2);

  // Normalize column names to standard keys
  const headerMap: Record<number, string> = {};
  const customHeaderMap: Record<number, string> = {};

  rawHeaders.forEach((h, index) => {
    const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    if (norm.includes('codigo') || norm === 'item' || norm === 'cod') {
      headerMap[index] = 'eap_codigo';
    } else if (norm.includes('descri') || norm.includes('servic') || norm === 'nome' || norm.includes('especific')) {
      headerMap[index] = 'descricao_servico';
    } else if (norm.includes('unid') || norm === 'un' || norm === 'un.' || norm === 'um') {
      headerMap[index] = 'unidade_medida';
    } else if (norm.includes('preco') || norm.includes('unit') || norm.includes('val_unit') || norm.includes('r$/un')) {
      headerMap[index] = 'preco_unitario';
    } else if (norm.includes('quant') || norm.includes('qtd') || norm.includes('volum')) {
      headerMap[index] = 'quantidade_contratada';
    } else if (norm.includes('desembols')) {
      headerMap[index] = 'valor_desembolsado';
    } else if (norm.includes('total') || norm.includes('subtotal')) {
      headerMap[index] = 'valor_total_contratado';
    } else if (norm.includes('tipo') || norm.includes('analit') || norm.includes('executa') || norm.includes('class')) {
      headerMap[index] = 'e_analitico';
    } else if (norm.includes('pai')) {
      headerMap[index] = 'eap_pai_codigo';
    } else {
      customHeaderMap[index] = h.trim();
    }
  });

  const items: ParsedEapItem[] = [];

  dataLines.forEach((line, lineIdx) => {
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length === 0) return;

    let eap_codigo = '';
    let descricao_servico = '';
    let unidade_medida: string | null = null;
    let preco_unitario = 0;
    let quantidade_contratada = 0;
    let valor_total_contratado = 0;
    let valor_desembolsado = 0;
    let e_analitico: boolean | undefined = undefined;
    let eap_pai_codigo: string | null = null;
    const campos_adicionais: Record<string, any> = {};

    cells.forEach((cellVal, cellIdx) => {
      const knownKey = headerMap[cellIdx];
      if (knownKey === 'eap_codigo') eap_codigo = cellVal;
      else if (knownKey === 'descricao_servico') descricao_servico = cellVal;
      else if (knownKey === 'unidade_medida') unidade_medida = cellVal || null;
      else if (knownKey === 'preco_unitario') preco_unitario = parseNumber(cellVal);
      else if (knownKey === 'quantidade_contratada') quantidade_contratada = parseNumber(cellVal);
      else if (knownKey === 'valor_total_contratado') valor_total_contratado = parseNumber(cellVal);
      else if (knownKey === 'valor_desembolsado') valor_desembolsado = parseNumber(cellVal);
      else if (knownKey === 'e_analitico') {
        const valLower = cellVal.toLowerCase();
        e_analitico = valLower === 'sim' || valLower === 'true' || valLower === 'analitico' || valLower === '1';
      } else if (knownKey === 'eap_pai_codigo') {
        eap_pai_codigo = cellVal || null;
      } else if (customHeaderMap[cellIdx]) {
        campos_adicionais[customHeaderMap[cellIdx]] = cellVal;
      }
    });

    if (!eap_codigo && !descricao_servico) return;

    // Filter out sub-header rows or section titles that aren't valid hierarchical codes (e.g. "CÓDIGO", "PROJETOS", "NaN")
    const isHeaderOrInvalidCode =
      !eap_codigo ||
      eap_codigo.toLowerCase() === 'codigo' ||
      eap_codigo.toLowerCase() === 'item' ||
      eap_codigo.toLowerCase() === 'nan' ||
      eap_codigo.toUpperCase() === 'PROJETOS' ||
      !/^[\d.]+$/.test(eap_codigo);

    if (isHeaderOrInvalidCode) return;

    // Derived parent code if not explicitly given
    if (!eap_pai_codigo) {
      eap_pai_codigo = deriveParentCode(eap_codigo);
    }

    items.push({
      eap_codigo,
      eap_pai_codigo,
      descricao_servico,
      unidade_medida,
      preco_unitario,
      quantidade_contratada,
      valor_total_contratado: valor_total_contratado || (preco_unitario * quantidade_contratada),
      valor_desembolsado: valor_desembolsado || 0,
      e_analitico: e_analitico ?? false, // Will be auto-refined in Step 3 if children exist
      ordem: lineIdx + 1,
      campos_adicionais
    });
  });

  return { items, rawHeaders };
}

function parseMarkdownList(lines: string[]): { items: ParsedEapItem[]; rawHeaders: string[] } {
  const items: ParsedEapItem[] = [];
  const rawHeaders = ['eap_codigo', 'descricao_servico', 'unidade_medida', 'preco_unitario', 'quantidade_contratada'];

  lines.forEach((line, idx) => {
    // Match headers like "# 1. INFRAESTRUTURA" or list items like "- 1.1 Escavação (m³): Qtd 100, Preço 25.00"
    const cleanLine = line.replace(/^[#*-\s]+/, '').trim();
    if (!cleanLine) return;

    const matchCode = cleanLine.match(/^(\d+(?:\.\d+)*)\s*[-:]?\s*(.*)$/);
    if (matchCode) {
      const eap_codigo = matchCode[1];
      const rest = matchCode[2];
      const eap_pai_codigo = deriveParentCode(eap_codigo);

      let descricao_servico = rest;
      let unidade_medida: string | null = null;
      let preco_unitario = 0;
      let quantidade_contratada = 0;

      // Check if details are in format: "Escavação - Un: m³, Qtd: 100, Preço: 25.00"
      const unMatch = rest.match(/(?:un|unidade)[:\s]+([a-zA-Z0-9³²]+)/i);
      if (unMatch) unidade_medida = unMatch[1];

      const qtdMatch = rest.match(/(?:qtd|quantidade)[:\s]+([0-9.,]+)/i);
      if (qtdMatch) quantidade_contratada = parseNumber(qtdMatch[1]);

      const precoMatch = rest.match(/(?:preco|preço|val_unit)[:\s]+([0-9.,]+)/i);
      if (precoMatch) preco_unitario = parseNumber(precoMatch[1]);

      // Remove meta from description if found
      if (rest.includes('-')) {
        descricao_servico = rest.split('-')[0].trim();
      }

      items.push({
        eap_codigo,
        eap_pai_codigo,
        descricao_servico: descricao_servico || `Item ${eap_codigo}`,
        unidade_medida,
        preco_unitario,
        quantidade_contratada,
        valor_total_contratado: preco_unitario * quantidade_contratada,
        e_analitico: false,
        ordem: idx + 1,
        campos_adicionais: {}
      });
    }
  });

  return { items, rawHeaders };
}

/**
  * ETAPA 2: Ajustes das tabelas no BD em memória
  * Compara colunas do arquivo com o esquema de banco de dados
  */
export function alignTableSchemaInMemory(rawHeaders: string[], items: ParsedEapItem[]): SchemaAnalysisResult {
  const mappedColumns: string[] = [];
  const newCustomColumns: string[] = [];

  // Check custom columns collected from items
  const customSet = new Set<string>();
  items.forEach(it => {
    if (it.campos_adicionais) {
      Object.keys(it.campos_adicionais).forEach(k => customSet.add(k));
    }
  });

  rawHeaders.forEach(h => {
    const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const isStandard = [
      'codigo', 'item', 'eap_codigo', 'codigo eap', 'cod',
      'descricao', 'descricao_servico', 'servico', 'nome', 'item_descricao',
      'unidade', 'un', 'un.', 'unidade_medida', 'um',
      'preco', 'preco unitario', 'preco_unitario', 'val_unit', 'valor unitario', 'unitario',
      'quantidade', 'qtd', 'quantidade_contratada', 'qtd_contratada', 'volume',
      'total', 'valor_total', 'valor total', 'valor_total_contratado', 'subtotal',
      'desembolsado', 'valor desembolsado', 'valor_desembolsado', 'desembolso',
      'tipo', 'analitico', 'e_analitico', 'executavel', 'classe',
      'pai', 'eap_pai_codigo', 'codigo_pai'
    ].includes(norm);

    if (isStandard) {
      if (!mappedColumns.includes(h)) mappedColumns.push(h);
    } else {
      if (!newCustomColumns.includes(h)) newCustomColumns.push(h);
    }
  });

  customSet.forEach(c => {
    if (!newCustomColumns.includes(c)) newCustomColumns.push(c);
  });

  return {
    mappedColumns,
    newCustomColumns,
    standardDbColumns: STANDARD_DB_COLUMNS
  };
}

/**
  * ETAPA 3 & ETAPA 4: Ambiente de teste & Modelo Interpretado
  * Executa simulação, checagem de integridade, cálculos de rollup e detecção de diff
  */
export function simulateEapTestEnvironment(
  projetoId: string,
  parsedItems: ParsedEapItem[],
  rawHeaders: string[],
  existingDbItems: any[] = []
): SimulationResult {
  const issues: ValidationIssue[] = [];
  const schemaAnalysis = alignTableSchemaInMemory(rawHeaders, parsedItems);

  if (parsedItems.length === 0) {
    issues.push({
      type: 'error',
      code: 'EMPTY_FILE',
      message: 'Nenhum item válido de EAP foi encontrado no arquivo Markdown.'
    });
    return {
      valid: false,
      items: [],
      issues,
      metrics: {
        totalItems: 0,
        syntheticCount: 0,
        analyticCount: 0,
        totalContractValue: 0,
        newItemsCount: 0,
        updateItemsCount: 0
      },
      schemaAnalysis
    };
  }

  // 1. Map all item codes in this batch to check parent-child relationships
  const itemMap = new Map<string, ParsedEapItem>();
  const parentCodesSet = new Set<string>();

  parsedItems.forEach(item => {
    if (item.eap_pai_codigo) {
      parentCodesSet.add(item.eap_pai_codigo);
    }
    itemMap.set(item.eap_codigo, item);
  });

  // Also build map of existing DB items for parent fallback & action determination
  const existingMap = new Map<string, any>();
  existingDbItems.forEach(dbItem => {
    existingMap.set(dbItem.eap_codigo, dbItem);
  });

  // 2. Refine synthetic vs analytic classification
  parsedItems.forEach(item => {
    // Clean parent code if NaN or null string
    if (item.eap_pai_codigo && (item.eap_pai_codigo.toLowerCase() === 'nan' || item.eap_pai_codigo.toLowerCase() === 'null' || !item.eap_pai_codigo.trim())) {
      item.eap_pai_codigo = null;
    }

    // If an item is parent to any item in batch, it MUST be synthetic (e_analitico = false)
    const hasChildren = parentCodesSet.has(item.eap_codigo);
    if (hasChildren) {
      item.e_analitico = false;
      item.unidade_medida = null;
      item.preco_unitario = 0;
      item.quantidade_contratada = 0;
    } else {
      // If user did not specify, default leaf nodes to true
      item.e_analitico = true;
      // PostgreSQL constraint chk_analitico_valores requires unidade_medida IS NOT NULL when e_analitico = TRUE
      if (!item.unidade_medida || item.unidade_medida.trim() === '' || item.unidade_medida.toLowerCase() === 'nan' || item.unidade_medida.toLowerCase() === 'null') {
        item.unidade_medida = 'un';
      }
    }

    // Determine action (NEW vs UPDATE)
    if (existingMap.has(item.eap_codigo)) {
      item.action = 'UPDATE';
      item.id = existingMap.get(item.eap_codigo).id;
    } else {
      item.action = 'NEW';
    }
  });

  // 3. Parent Integrity Validation
  parsedItems.forEach(item => {
    if (item.eap_pai_codigo) {
      const parentInBatch = itemMap.has(item.eap_pai_codigo);
      const parentInDb = existingMap.has(item.eap_pai_codigo);
      if (!parentInBatch && !parentInDb) {
        issues.push({
          type: 'warning',
          code: 'MISSING_PARENT',
          message: `O item '${item.eap_codigo}' referencia o código pai '${item.eap_pai_codigo}', que não foi encontrado no arquivo nem no banco de dados.`,
          itemCode: item.eap_codigo
        });
      }
    }
  });

  // 4. Calculate leaf totals and rollup synthetic totals
  // Calculate leaf total
  parsedItems.forEach(item => {
    if (item.e_analitico) {
      item.valor_total_contratado = Math.round((item.preco_unitario * item.quantidade_contratada) * 100) / 100;
    }
  });

  // Rollup values from analytic items to synthetic items
  // Sort items by code depth descending so leaf nodes accumulate to parents first
  const sortedByDepthDesc = [...parsedItems].sort((a, b) => {
    const depthA = a.eap_codigo.split('.').length;
    const depthB = b.eap_codigo.split('.').length;
    return depthB - depthA;
  });

  // Map to hold aggregated synthetic values
  const syntheticTotals = new Map<string, number>();
  const syntheticDesembolsado = new Map<string, number>();

  sortedByDepthDesc.forEach(item => {
    const itemVal = item.e_analitico ? item.valor_total_contratado : (syntheticTotals.get(item.eap_codigo) || 0);
    const itemDesem = item.e_analitico ? (item.valor_desembolsado || 0) : (syntheticDesembolsado.get(item.eap_codigo) || 0);

    if (item.eap_pai_codigo) {
      const currentParentVal = syntheticTotals.get(item.eap_pai_codigo) || 0;
      syntheticTotals.set(item.eap_pai_codigo, Math.round((currentParentVal + itemVal) * 100) / 100);

      const currentParentDesem = syntheticDesembolsado.get(item.eap_pai_codigo) || 0;
      syntheticDesembolsado.set(item.eap_pai_codigo, Math.round((currentParentDesem + itemDesem) * 100) / 100);
    }
  });

  // Assign aggregated totals to synthetic items
  parsedItems.forEach(item => {
    if (!item.e_analitico) {
      item.valor_total_contratado = syntheticTotals.get(item.eap_codigo) || 0;
      item.valor_desembolsado = syntheticDesembolsado.get(item.eap_codigo) || 0;
    }
  });

  // 5. Compute overall metrics
  const totalItems = parsedItems.length;
  const syntheticCount = parsedItems.filter(i => !i.e_analitico).length;
  const analyticCount = parsedItems.filter(i => i.e_analitico).length;
  const newItemsCount = parsedItems.filter(i => i.action === 'NEW').length;
  const updateItemsCount = parsedItems.filter(i => i.action === 'UPDATE').length;

  // Root items total contract value sum
  const rootItems = parsedItems.filter(i => !i.eap_pai_codigo);
  const totalContractValue = rootItems.reduce((acc, curr) => acc + curr.valor_total_contratado, 0);

  const hasBlockingErrors = issues.some(i => i.type === 'error');

  return {
    valid: !hasBlockingErrors,
    items: parsedItems,
    issues,
    metrics: {
      totalItems,
      syntheticCount,
      analyticCount,
      totalContractValue: Math.round(totalContractValue * 100) / 100,
      newItemsCount,
      updateItemsCount
    },
    schemaAnalysis
  };
}

/**
  * ETAPA 5: Importar
  * Executa a gravação dos dados validados no banco PostgreSQL / Supabase
  */
export async function executeEapImport(
  client: any,
  saveRecordFn: Function,
  projetoId: string,
  items: ParsedEapItem[]
): Promise<{ success: boolean; importedCount: number; errors?: any[] }> {
  if (!items || items.length === 0) {
    return { success: false, importedCount: 0, errors: ['Nenhum item para importar.'] };
  }

  const errors: any[] = [];
  let importedCount = 0;

  // Pre-fetch existing database items for this project to resolve existing record IDs
  const existingDbMap = new Map<string, string>();
  try {
    const { data: dbItems } = await client
      .from("itens_eap")
      .select("id, eap_codigo")
      .eq("projeto_id", projetoId);

    if (dbItems && Array.isArray(dbItems)) {
      dbItems.forEach((dbRow: any) => {
        if (dbRow.eap_codigo && dbRow.id) {
          existingDbMap.set(String(dbRow.eap_codigo).trim(), dbRow.id);
        }
      });
    }
  } catch (e) {
    console.warn("[EAP Importer] Could not pre-fetch existing items from DB:", e);
  }

  // Sort items by code hierarchy natural order (e.g. 1, 1.1, 1.1.1, 1.2, 1.10) so parent records exist before children
  const sortedItems = [...items].sort((a, b) => compareEapCodes(a.eap_codigo, b.eap_codigo));

  for (const item of sortedItems) {
    const isAnalytic = !!item.e_analitico;

    let cleanUnidade: string | null = null;
    if (isAnalytic) {
      cleanUnidade = (item.unidade_medida && item.unidade_medida.trim() !== '' && item.unidade_medida.toLowerCase() !== 'nan' && item.unidade_medida.toLowerCase() !== 'null')
        ? item.unidade_medida.trim()
        : 'un';
    }

    let cleanPai: string | null = null;
    if (item.eap_pai_codigo && item.eap_pai_codigo.trim() !== '' && item.eap_pai_codigo.toLowerCase() !== 'nan' && item.eap_pai_codigo.toLowerCase() !== 'null') {
      cleanPai = item.eap_pai_codigo.trim();
    }

    const itemCode = String(item.eap_codigo).trim();

    const upsertData: any = {
      projeto_id: projetoId,
      eap_codigo: itemCode,
      eap_pai_codigo: cleanPai,
      descricao_servico: item.descricao_servico ? String(item.descricao_servico).trim() : `Item ${itemCode}`,
      unidade_medida: cleanUnidade,
      preco_unitario: isNaN(Number(item.preco_unitario)) ? 0 : Number(item.preco_unitario || 0),
      quantidade_contratada: isNaN(Number(item.quantidade_contratada)) ? 0 : Number(item.quantidade_contratada || 0),
      valor_total_contratado: isNaN(Number(item.valor_total_contratado)) ? 0 : Number(item.valor_total_contratado || 0),
      valor_desembolsado: isNaN(Number(item.valor_desembolsado)) ? 0 : Number(item.valor_desembolsado || 0),
      e_analitico: isAnalytic,
      ordem: isNaN(Number(item.ordem)) ? 0 : Number(item.ordem || 0),
      data_inicio: item.data_inicio || null,
      data_fim: item.data_fim || null,
      duracao_dias: item.duracao_dias != null ? Number(item.duracao_dias) : null,
      predecessores: Array.isArray(item.predecessores) ? item.predecessores : null,
      percentual_executado_financeiro: item.percentual_executado_financeiro != null ? Number(item.percentual_executado_financeiro) : 0
    };

    // Use item.id if available or lookup from database map
    const existingId = item.id || existingDbMap.get(itemCode);
    if (existingId) {
      upsertData.id = existingId;
    }

    const { error } = await saveRecordFn(client, "itens_eap", upsertData, {
      single: false
    });

    if (error) {
      console.error(`[EAP Importer] Error saving item ${itemCode}:`, error);
      errors.push({ itemCode, message: error.message || String(error) });
    } else {
      importedCount++;
    }
  }

  return {
    success: errors.length === 0,
    importedCount,
    errors: errors.length > 0 ? errors : undefined
  };
}

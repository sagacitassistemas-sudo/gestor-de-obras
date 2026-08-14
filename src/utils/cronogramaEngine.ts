/**
 * MOTOR DE CRONOGRAMAS (GANTT ENGINE)
 * Implementação da Lógica de Cálculo de Rede, EAP/WBS, Auto-Scheduling e Rollup
 * conforme especificação de arquitetura.
 */

// ─── Tipos e Interfaces ───────────────────────────────────────────────────────

export type ElementType = 'leaf' | 'summary' | 'milestone';

export type InteractionType = 'body_move' | 'resize_right' | 'resize_left';

export interface EapEngineItem {
  id: string;
  item_eap_id?: string;
  eap_codigo: string;
  eap_pai_codigo?: string | null;
  descricao_servico: string;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;    // YYYY-MM-DD
  duracao_dias: number;
  e_analitico: boolean;
  ordem?: number;
  predecessores?: string[];
  percentual_executado_financeiro?: number;
  valor_total_contratado?: number;
}

export interface EapTreeNode {
  item: EapEngineItem;
  parent?: EapTreeNode;
  children: EapTreeNode[];
  level: number; // 0 = raiz, 1 = grupo, 2 = subtarefa...
}

// ─── Passo 1: Leitura e Montagem da Árvore da EAP/WBS ─────────────────────────

/**
 * Constrói a estrutura hierárquica pai/filho (EAP/WBS) organizando as etapas em
 * níveis de aninhamento (tarefas raiz, grupos e subtarefas).
 */
export function buildEapTree(items: EapEngineItem[]): {
  roots: EapTreeNode[];
  nodeMap: Map<string, EapTreeNode>;
  orderedItems: EapEngineItem[];
} {
  const nodeMap = new Map<string, EapTreeNode>();

  items.forEach(item => {
    nodeMap.set(item.eap_codigo, {
      item: { ...item },
      children: [],
      level: 0,
    });
  });

  const roots: EapTreeNode[] = [];

  nodeMap.forEach((node, code) => {
    let parentCode = node.item.eap_pai_codigo;

    if (!parentCode || !nodeMap.has(parentCode)) {
      const parts = code.split('.');
      while (parts.length > 1) {
        parts.pop();
        const candidate = parts.join('.');
        if (nodeMap.has(candidate)) {
          parentCode = candidate;
          break;
        }
      }
    }

    if (parentCode && nodeMap.has(parentCode) && parentCode !== code) {
      const parentNode = nodeMap.get(parentCode)!;
      node.parent = parentNode;
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const orderedItems: EapEngineItem[] = [];

  const traverse = (node: EapTreeNode, level: number) => {
    node.level = level;
    orderedItems.push(node.item);
    node.children.sort((a, b) => compareEapCodes(a.item.eap_codigo, b.item.eap_codigo));
    node.children.forEach(child => traverse(child, level + 1));
  };

  roots.sort((a, b) => compareEapCodes(a.item.eap_codigo, b.item.eap_codigo));
  roots.forEach(root => traverse(root, 0));

  return { roots, nodeMap, orderedItems };
}

export function compareEapCodes(a: string, b: string): number {
  const partsA = a.split('.').map(p => parseInt(p, 10));
  const partsB = b.split('.').map(p => parseInt(p, 10));
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const valA = isNaN(partsA[i]) ? 0 : partsA[i];
    const valB = isNaN(partsB[i]) ? 0 : partsB[i];
    if (valA !== valB) return valA - valB;
  }
  return a.localeCompare(b);
}

export interface ParsedPredecessor {
  code: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number;
}

// ─── Helpers de Data (Imunes a Fuso Horário) ──────────────────────────────────

export function parseEngineDate(ymd: string | null | undefined, fallbackDate?: Date): Date {
  const fallback = fallbackDate ?? new Date();
  if (!ymd) return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0);
  const dateStr = String(ymd).trim().split('T')[0];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 12, 0, 0);
    }
  }
  const dt = new Date(ymd);
  if (isNaN(dt.getTime())) return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0);
}

export function formatEngineYMD(d: Date | string): string {
  if (typeof d === 'string') {
    const clean = d.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addEngineDays(ymd: string, days: number): string {
  const dt = parseEngineDate(ymd);
  dt.setDate(dt.getDate() + days);
  return formatEngineYMD(dt);
}

export function diffEngineDays(ymdEnd: string, ymdStart: string): number {
  const d1 = parseEngineDate(ymdEnd);
  const d2 = parseEngineDate(ymdStart);
  return Math.round((d1.getTime() - d2.getTime()) / 86400000);
}

// ─── Passo 2: Classificação dos Tipos de Elementos ────────────────────────────

export function classifyElementType(item: EapEngineItem, allItems: EapEngineItem[]): ElementType {
  const hasChildren = allItems.some(
    other => other.eap_codigo !== item.eap_codigo && other.eap_codigo.startsWith(item.eap_codigo + '.')
  );
  if (hasChildren || !item.e_analitico) {
    return 'summary';
  }
  if (item.duracao_dias === 0) {
    return 'milestone';
  }
  return 'leaf';
}

// ─── Parser de Predecessoras (ex: "1.1.1FS+2" ou "1.1.1") ─────────────────────

export function parsePredecessorString(predStr: string): ParsedPredecessor {
  const clean = String(predStr).trim();
  const match = clean.match(/^([A-Za-z0-9.]+?)(?:(FS|SS|FF|SF))?(?:([+-]\d+))?$/);
  if (!match) return { code: clean, type: 'FS', lag: 0 };
  return {
    code: match[1],
    type: (match[2] as ParsedPredecessor['type']) || 'FS',
    lag: parseInt(match[3] || '0', 10),
  };
}

// ─── Passo 3: Equação Fundamental & Posicionamento de Tarefas Folha ───────────

/**
 * Aplica a equação fundamental do Gantt para calcular data_fim:
 * Fim = Início + Duração - 1 dia (para Duração >= 1)
 */
export function calculateLeafFinishDate(dataInicio: string, duracaoDias: number): string {
  const dur = Math.max(0, duracaoDias);
  if (dur === 0) return dataInicio; // Marco (Milestone)
  return addEngineDays(dataInicio, dur - 1);
}

/**
 * Calcula a data de início mínima exigida pelas predecessoras conectadas.
 */
export function calculatePredecessorRequiredStart(
  item: EapEngineItem,
  itemsMap: Map<string, EapEngineItem>,
  projStart: string
): string | null {
  // Coleta predecessores da própria tarefa e de todos os seus ancestrais hierárquicos
  const allPreds: string[] = [...(item.predecessores ?? [])];

  let currCode = item.eap_codigo;
  while (currCode.includes('.')) {
    const parts = currCode.split('.');
    parts.pop();
    currCode = parts.join('.');
    const parent = itemsMap.get(currCode);
    if (parent?.predecessores?.length) {
      allPreds.push(...parent.predecessores);
    }
  }

  if (!allPreds.length) return null;

  let maxReqStart: string | null = null;

  allPreds.forEach(predRaw => {
    const { code, type, lag } = parsePredecessorString(predRaw);
    const pred = itemsMap.get(code);
    if (!pred) return;

    const predStart = pred.data_inicio || projStart;
    const predEnd = pred.data_fim || calculateLeafFinishDate(predStart, pred.duracao_dias);
    const itemDur = Math.max(1, item.duracao_dias || 1);

    let reqStart: string;
    if (type === 'FS') {
      reqStart = addEngineDays(predEnd, 1 + lag);
    } else if (type === 'SS') {
      reqStart = addEngineDays(predStart, lag);
    } else if (type === 'FF') {
      reqStart = addEngineDays(predEnd, lag - itemDur + 1);
    } else /* SF */ {
      reqStart = addEngineDays(predStart, lag - itemDur + 1);
    }

    if (!maxReqStart || reqStart > maxReqStart) {
      maxReqStart = reqStart;
    }
  });

  return maxReqStart;
}

// ─── Passo 4: Dimensionamento e Rollup das Atividades Sumário ────────────────

/**
 * Recalcula as datas, duração e progresso ponderado de todas as tarefas sumário (pais)
 * percorrendo a árvore EAP criada no Passo 1 (buildEapTree) dos nós mais profundos até as raízes.
 */
export function executeSummaryRollup(itemsMap: Map<string, EapEngineItem>, projStart: string): void {
  const items = Array.from(itemsMap.values());
  const { nodeMap } = buildEapTree(items);

  // Ordena os nós por nível de aninhamento decrescente (filhos folha primeiro, depois sub-grupos, depois raízes)
  const sortedNodes = Array.from(nodeMap.values()).sort((a, b) => b.level - a.level);

  sortedNodes.forEach(node => {
    if (!node.children.length) return; // Tarefa folha ativa

    let minStart: string | null = null;
    let maxEnd: string | null = null;
    let totalValor = 0;
    let weightedProgressSum = 0;

    node.children.forEach(childNode => {
      const child = childNode.item;
      const s = child.data_inicio || projStart;
      const dur = Math.max(1, child.duracao_dias || 1);
      const e = child.data_fim || calculateLeafFinishDate(s, dur);

      if (!minStart || s < minStart) minStart = s;
      if (!maxEnd || e > maxEnd) maxEnd = e;

      const valor = child.valor_total_contratado || dur;
      const prog = child.percentual_executado_financeiro || 0;
      totalValor += valor;
      weightedProgressSum += prog * valor;
    });

    if (minStart && maxEnd) {
      node.item.data_inicio = minStart;
      node.item.data_fim = maxEnd;
      node.item.duracao_dias = Math.max(1, diffEngineDays(maxEnd, minStart) + 1);
      node.item.percentual_executado_financeiro = totalValor > 0
        ? Math.round((weightedProgressSum / totalValor) * 100) / 100
        : 0;

      // Sincroniza o item recalculado de volta no mapa de itens
      itemsMap.set(node.item.eap_codigo, node.item);
    }
  });

  // Trava de invariante estrito em profundidade total para tarefas sintéticas
  itemsMap.forEach((parentItem, parentCode) => {
    const node = nodeMap.get(parentCode);
    if (!node || !node.children.length) return;

    const leafDescendants = Array.from(itemsMap.values()).filter(
      c => c.eap_codigo !== parentCode && c.eap_codigo.startsWith(parentCode + '.') && c.e_analitico
    );
    if (!leafDescendants.length) return;

    let absMinStart: string | null = null;
    let absMaxEnd: string | null = null;

    leafDescendants.forEach(leaf => {
      const s = leaf.data_inicio || projStart;
      const dur = Math.max(1, leaf.duracao_dias || 1);
      const e = leaf.data_fim || calculateLeafFinishDate(s, dur);
      if (!absMinStart || s < absMinStart) absMinStart = s;
      if (!absMaxEnd || e > absMaxEnd) absMaxEnd = e;
    });

    if (absMinStart && absMaxEnd) {
      parentItem.data_inicio = absMinStart;
      parentItem.data_fim = absMaxEnd;
      parentItem.duracao_dias = Math.max(1, diffEngineDays(absMaxEnd, absMinStart) + 1);
    }
  });
}

// ─── Passo 7: Recálculo em Cadeia (Auto-Scheduling & Efeito Dominó) ─────────

/**
 * Propaga dependências para todas as tarefas sucessoras conectadas direta ou indiretamente.
 */
export function propagateAutoScheduling(itemsMap: Map<string, EapEngineItem>, projStart: string): boolean {
  let changed = false;
  let iterations = 0;
  let anyChange = true;

  while (anyChange && iterations < 100) {
    anyChange = false;
    iterations++;

    // Atualiza rollup de agrupadores antes de avaliar restrições
    executeSummaryRollup(itemsMap, projStart);

    itemsMap.forEach(item => {
      const reqStart = calculatePredecessorRequiredStart(item, itemsMap, projStart);
      if (reqStart) {
        const currStart = item.data_inicio || projStart;
        if (currStart < reqStart) {
          item.data_inicio = reqStart;
          item.data_fim = calculateLeafFinishDate(reqStart, item.duracao_dias);
          anyChange = true;
          changed = true;
        }
      }
    });
  }

  executeSummaryRollup(itemsMap, projStart);
  return changed;
}

// ─── Passos 5 & 6: Mapeamento de Interação Gráfica e Edição ──────────────────

export interface UserInteractionPayload {
  eap_codigo: string;
  interactionType: InteractionType;
  newStart?: string;
  newEnd?: string;
  newDuration?: number;
}

/**
 * Processa a interação visual do usuário de acordo com a intenção (Passos 5, 6 e 7).
 * Retorna a lista contendo todas as tarefas modificadas pelo efeito dominó.
 */
export function processUserInteraction(
  items: EapEngineItem[],
  interaction: UserInteractionPayload,
  projStart: string
): { updatedItems: EapEngineItem[]; affectedItems: EapEngineItem[] } {
  const itemsMap = new Map<string, EapEngineItem>(items.map(i => [i.eap_codigo, { ...i }]));
  const item = itemsMap.get(interaction.eap_codigo);

  if (!item) {
    return { updatedItems: items, affectedItems: [] };
  }

  // Critério de Aceitação 1: Tarefas sumário NUNCA aceitam alteração direta de datas pelo usuário
  const isSummary = classifyElementType(item, items) === 'summary';
  if (isSummary) {
    console.warn(`[CronogramaEngine] Alteração direta em tarefa sumário '${item.eap_codigo}' é rejeitada.`);
    return { updatedItems: items, affectedItems: [] };
  } else {
    // Mapeamento dos 3 pontos de foco para tarefas folha (Passo 5 e 6)
    if (interaction.interactionType === 'body_move') {
      // Movimento do Corpo: Mantém Duração fixa, altera Início e recalcula Fim
      if (interaction.newStart) {
        item.data_inicio = interaction.newStart;
        item.data_fim = calculateLeafFinishDate(item.data_inicio, item.duracao_dias);
      }
    } else if (interaction.interactionType === 'resize_right') {
      // Redimensionamento Borda Direita: Mantém Início fixo, altera Duração e recalcula Fim
      if (interaction.newEnd) {
        const s = item.data_inicio || projStart;
        const e = interaction.newEnd;
        item.duracao_dias = Math.max(1, diffEngineDays(e, s) + 1);
        item.data_fim = e;
      } else if (interaction.newDuration != null) {
        item.duracao_dias = Math.max(1, interaction.newDuration);
        item.data_fim = calculateLeafFinishDate(item.data_inicio, item.duracao_dias);
      }
    } else if (interaction.interactionType === 'resize_left') {
      // Redimensionamento Borda Esquerda: Mantém Fim fixo, altera Início e Duração
      if (interaction.newStart) {
        const e = item.data_fim || calculateLeafFinishDate(item.data_inicio, item.duracao_dias);
        const s = interaction.newStart;
        item.duracao_dias = Math.max(1, diffEngineDays(e, s) + 1);
        item.data_inicio = s;
        item.data_fim = e;
      }
    }
  }

  // Validação do Critério de Aceitação 2: Respeitar a restrição mínima de predecessoras
  const reqStart = calculatePredecessorRequiredStart(item, itemsMap, projStart);
  if (reqStart && item.data_inicio < reqStart) {
    item.data_inicio = reqStart;
    item.data_fim = calculateLeafFinishDate(reqStart, item.duracao_dias);
  }

  // Passo 7: Recálculo em Cadeia (Efeito Dominó & Rollup)
  propagateAutoScheduling(itemsMap, projStart);
  executeSummaryRollup(itemsMap, projStart);

  const updatedItems = Array.from(itemsMap.values());

  // Identificar todas as tarefas que sofreram modificação para persistência em lote
  const originalMap = new Map<string, EapEngineItem>(items.map(i => [i.eap_codigo, i]));
  const affectedItems = updatedItems.filter(up => {
    const orig = originalMap.get(up.eap_codigo);
    if (!orig) return true;
    return (
      orig.data_inicio !== up.data_inicio ||
      orig.data_fim !== up.data_fim ||
      orig.duracao_dias !== up.duracao_dias ||
      orig.percentual_executado_financeiro !== up.percentual_executado_financeiro
    );
  });

  return { updatedItems, affectedItems };
}

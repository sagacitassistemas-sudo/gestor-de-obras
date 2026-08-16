/**
 * PARSER DE ARQUIVOS MS PROJECT XML (.xml)
 * 
 * Converte o formato XML do Microsoft Project (MSPDI schema) para o formato
 * EapEngineItem[] utilizado pelo Motor do Cronograma (cronogramaEngine.ts).
 * 
 * Elementos parseados:
 * - <Task>: UID, Name, OutlineNumber, OutlineLevel, Start, Finish, Duration
 * - <PredecessorLink>: PredecessorUID, Type (0=FF,1=FS,2=SF,3=SS), LinkLag
 * 
 * Funciona 100% no browser via DOMParser nativo (zero dependências externas).
 */

import type { EapEngineItem } from './cronogramaEngine';
import { formatEngineYMD } from './cronogramaEngine';

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface MspTask {
  uid: number;
  id: number;
  name: string;
  outlineNumber: string;   // ex: "1", "1.1", "1.1.1"
  outlineLevel: number;    // 0 = projeto raiz, 1 = nível 1...
  start: string;           // YYYY-MM-DD
  finish: string;          // YYYY-MM-DD
  durationDays: number;
  isSummary: boolean;
  isMilestone: boolean;
  predecessors: MspPredecessor[];
  percentComplete: number;
}

interface MspPredecessor {
  predecessorUID: number;
  type: number;     // 0=FF, 1=FS (default), 2=SF, 3=SS  — atenção: MS Project inverte a ordem
  lagDays: number;
}

export interface MspImportResult {
  projectName: string;
  projectStart: string;
  items: EapEngineItem[];
  warnings: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extrai texto de um elemento filho XML, retorna fallback se ausente */
function getChildText(parent: Element, tagName: string, fallback = ''): string {
  // MS Project XML pode usar namespace. Tentamos com e sem namespace.
  const el = parent.getElementsByTagName(tagName)[0]
    ?? parent.querySelector(tagName);
  return el?.textContent?.trim() ?? fallback;
}

/** Extrai número inteiro de um elemento filho XML */
function getChildInt(parent: Element, tagName: string, fallback = 0): number {
  const val = parseInt(getChildText(parent, tagName), 10);
  return isNaN(val) ? fallback : val;
}

/** Extrai número decimal de um elemento filho XML */
function getChildFloat(parent: Element, tagName: string, fallback = 0): number {
  const val = parseFloat(getChildText(parent, tagName));
  return isNaN(val) ? fallback : val;
}

/**
 * Converte duração ISO 8601 do MS Project (ex: "PT24H0M0S", "P5D", "PT40H0M0S")
 * para número de dias úteis (considerando 8h/dia como padrão MS Project).
 */
function parseMspDuration(isoStr: string): number {
  if (!isoStr) return 1;

  // Formato: PnYnMnDTnHnMnS
  const match = isoStr.match(
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
  );
  if (!match) return 1;

  const years = parseInt(match[1] || '0', 10);
  const months = parseInt(match[2] || '0', 10);
  const days = parseInt(match[3] || '0', 10);
  const hours = parseInt(match[4] || '0', 10);
  const minutes = parseInt(match[5] || '0', 10);

  // Converte tudo para dias (8h = 1 dia útil no MS Project)
  let totalDays = days + (years * 365) + (months * 30);
  if (hours > 0 || minutes > 0) {
    totalDays += (hours + minutes / 60) / 8; // 8h por dia útil
  }

  return Math.max(1, Math.round(totalDays));
}

/**
 * Converte datetime do MS Project (ex: "2026-08-01T08:00:00") para YYYY-MM-DD
 */
function parseMspDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return formatEngineYMD(d);
}

/**
 * Converte tipo de link do MS Project para nossa notação:
 * MS Project: 0=FF, 1=FS, 2=SF, 3=SS
 * Nosso formato: 'FS' | 'SS' | 'FF' | 'SF'
 */
function mspLinkTypeToString(type: number): 'FS' | 'SS' | 'FF' | 'SF' {
  switch (type) {
    case 0: return 'FF';
    case 1: return 'FS';
    case 2: return 'SF';
    case 3: return 'SS';
    default: return 'FS';
  }
}

/**
 * Converte LinkLag (em décimos de minuto) para dias:
 * MS Project armazena lag em "tenths of minutes" (1 dia 8h = 4800)
 * 4800 tenths = 480 min = 8h = 1 dia útil
 */
function mspLagToDays(lagTenths: number): number {
  if (!lagTenths) return 0;
  const minutes = lagTenths / 10;
  const hours = minutes / 60;
  const days = hours / 8; // 8h = 1 dia útil
  return Math.round(days);
}

// ─── Parser Principal ────────────────────────────────────────────────────────

/**
 * Parseia um arquivo XML do MS Project e retorna os itens no formato EapEngineItem[].
 * 
 * @param xmlString - Conteúdo completo do arquivo XML como string
 * @returns MspImportResult com itens, nome do projeto e warnings
 */
export function parseMsProjectXml(xmlString: string): MspImportResult {
  const warnings: string[] = [];

  // Parse do XML usando DOMParser nativo do browser
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // Verificar erros de parsing
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error(`Erro ao interpretar o arquivo. Certifique-se de que exportou o projeto como "XML" no MS Project (não utilize o arquivo binário .mpp direto). Detalhes técnicos: ${parseError.textContent}`);
  }

  // ── Metadados do Projeto ─────────────────────────────────────────────────
  const projectName = getChildText(doc.documentElement, 'Name', 'Projeto Importado');
  const projectStartRaw = getChildText(doc.documentElement, 'StartDate')
    || getChildText(doc.documentElement, 'CreationDate');
  const projectStart = parseMspDate(projectStartRaw) || formatEngineYMD(new Date());

  // ── Extrair todas as <Task> ──────────────────────────────────────────────
  const taskElements = doc.getElementsByTagName('Task');
  const mspTasks: MspTask[] = [];
  const uidToOutline = new Map<number, string>();

  for (let i = 0; i < taskElements.length; i++) {
    const el = taskElements[i];

    const uid = getChildInt(el, 'UID', -1);
    const id = getChildInt(el, 'ID', 0);
    const name = getChildText(el, 'Name');
    const outlineNumber = getChildText(el, 'OutlineNumber');
    const outlineLevel = getChildInt(el, 'OutlineLevel', 0);
    const startRaw = getChildText(el, 'Start');
    const finishRaw = getChildText(el, 'Finish');
    const durationRaw = getChildText(el, 'Duration');
    const isSummary = getChildText(el, 'Summary') === '1';
    const isMilestone = getChildText(el, 'Milestone') === '1';
    const percentComplete = getChildFloat(el, 'PercentComplete', 0);

    // Ignorar tarefa raiz do projeto (OutlineLevel 0, UID 0)
    if (outlineLevel === 0 && uid === 0) {
      uidToOutline.set(uid, outlineNumber || '0');
      continue;
    }

    // Ignorar tarefas sem nome (artefatos do MS Project)
    if (!name && !outlineNumber) {
      warnings.push(`Tarefa UID=${uid} ignorada (sem nome e sem código EAP).`);
      continue;
    }

    // ── Predecessores ────────────────────────────────────────────────────
    const predLinks = el.getElementsByTagName('PredecessorLink');
    const predecessors: MspPredecessor[] = [];
    for (let j = 0; j < predLinks.length; j++) {
      const pl = predLinks[j];
      const predUID = getChildInt(pl, 'PredecessorUID', -1);
      const linkType = getChildInt(pl, 'Type', 1); // default FS
      const linkLag = getChildInt(pl, 'LinkLag', 0);
      if (predUID >= 0) {
        predecessors.push({
          predecessorUID: predUID,
          type: linkType,
          lagDays: mspLagToDays(linkLag),
        });
      }
    }

    const start = parseMspDate(startRaw) || projectStart;
    const finish = parseMspDate(finishRaw) || '';
    const durationDays = durationRaw ? parseMspDuration(durationRaw) : 1;

    const task: MspTask = {
      uid, id, name,
      outlineNumber: outlineNumber || String(id),
      outlineLevel,
      start, finish,
      durationDays: isMilestone ? 0 : Math.max(1, durationDays),
      isSummary,
      isMilestone,
      predecessors,
      percentComplete,
    };

    mspTasks.push(task);
    uidToOutline.set(uid, task.outlineNumber);
  }

  if (mspTasks.length === 0) {
    throw new Error('Nenhuma tarefa encontrada no arquivo XML. Verifique se o formato é MS Project XML (.xml).');
  }

  // ── Converter para EapEngineItem[] ───────────────────────────────────────

  const items: EapEngineItem[] = mspTasks.map(task => {
    // Converter predecessores de UID para OutlineNumber (nosso eap_codigo)
    const predecessores: string[] = [];
    task.predecessors.forEach(pred => {
      const predOutline = uidToOutline.get(pred.predecessorUID);
      if (!predOutline) {
        warnings.push(
          `Predecessora UID=${pred.predecessorUID} da tarefa "${task.name}" (${task.outlineNumber}) não encontrada.`
        );
        return;
      }
      const linkTypeStr = mspLinkTypeToString(pred.type);
      const lagStr = pred.lagDays > 0 ? `+${pred.lagDays}` : pred.lagDays < 0 ? String(pred.lagDays) : '';
      
      // Formato compacto: "1.1.1" (FS sem lag) ou "1.1.1SS+2"
      if (linkTypeStr === 'FS' && !pred.lagDays) {
        predecessores.push(predOutline);
      } else {
        predecessores.push(`${predOutline}${linkTypeStr}${lagStr}`);
      }
    });

    return {
      id: task.outlineNumber,
      eap_codigo: task.outlineNumber,
      descricao_servico: task.name,
      data_inicio: task.start,
      data_fim: task.finish,
      duracao_dias: task.durationDays,
      e_analitico: !task.isSummary,
      predecessores,
      percentual_executado_financeiro: task.percentComplete,
    };
  });

  return {
    projectName,
    projectStart,
    items,
    warnings,
  };
}

/**
 * Lê um File do input[type=file] e retorna o conteúdo como string.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo "${file.name}".`));
    reader.readAsText(file, 'UTF-8');
  });
}

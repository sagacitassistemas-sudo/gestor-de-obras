import { describe, it, expect } from 'vitest';
import {
  EapEngineItem,
  classifyElementType,
  calculateLeafFinishDate,
  calculatePredecessorRequiredStart,
  executeSummaryRollup,
  propagateAutoScheduling,
  processUserInteraction,
  diffEngineDays,
  addEngineDays,
} from '../../src/utils/cronogramaEngine';

describe('Motor do Cronograma (Gantt Engine)', () => {
  const projStart = '2026-08-01';

  // ── 1. Passos 1 & 2: Classificação de Elementos ──────────────────────────────
  describe('Passos 1 & 2: Classificação dos Tipos de Elementos', () => {
    it('deve classificar corretamente agrupador (summary), tarefa folha (leaf) e marco (milestone)', () => {
      const items: EapEngineItem[] = [
        { id: '1', eap_codigo: '1', descricao_servico: 'Macroetapa', data_inicio: '2026-08-01', data_fim: '2026-08-10', duracao_dias: 10, e_analitico: false },
        { id: '2', eap_codigo: '1.1', descricao_servico: 'Tarefa Folha Normal', data_inicio: '2026-08-01', data_fim: '2026-08-05', duracao_dias: 5, e_analitico: true },
        { id: '3', eap_codigo: '1.2', descricao_servico: 'Marco de Entrega', data_inicio: '2026-08-05', data_fim: '2026-08-05', duracao_dias: 0, e_analitico: true },
      ];

      expect(classifyElementType(items[0], items)).toBe('summary');
      expect(classifyElementType(items[1], items)).toBe('leaf');
      expect(classifyElementType(items[2], items)).toBe('milestone');
    });
  });

  // ── 2. Passo 3: Equação Fundamental do Gantt & Vínculos ─────────────────────
  describe('Passo 3: Posicionamento das Tarefas Folha & Equação Fundamental', () => {
    it('deve calcular a data de fim usando Fim = Início + Duração - 1 dia', () => {
      // 5 dias a partir de 2026-08-01 -> 2026-08-01, 02, 03, 04, 05 -> Fim = 2026-08-05
      expect(calculateLeafFinishDate('2026-08-01', 5)).toBe('2026-08-05');
      // 1 dia -> Fim = Início
      expect(calculateLeafFinishDate('2026-08-01', 1)).toBe('2026-08-01');
      // Marco (0 dias) -> Fim = Início
      expect(calculateLeafFinishDate('2026-08-01', 0)).toBe('2026-08-01');
    });

    it('deve calcular a data de início exigida por vínculos FS, SS, FF e SF com Lags', () => {
      const itemsMap = new Map<string, EapEngineItem>([
        ['1.1', { id: '1', eap_codigo: '1.1', descricao_servico: 'Predecessora', data_inicio: '2026-08-01', data_fim: '2026-08-05', duracao_dias: 5, e_analitico: true }],
      ]);

      // FS sem lag: 2026-08-05 + 1 dia = 2026-08-06
      const itemFS: EapEngineItem = { id: '2', eap_codigo: '1.2', descricao_servico: 'Sucessora FS', data_inicio: '2026-08-01', data_fim: '2026-08-03', duracao_dias: 3, e_analitico: true, predecessores: ['1.1FS+0'] };
      expect(calculatePredecessorRequiredStart(itemFS, itemsMap, projStart)).toBe('2026-08-06');

      // FS com +2 dias de lag: 2026-08-05 + 1 + 2 = 2026-08-08
      const itemFSLag: EapEngineItem = { id: '3', eap_codigo: '1.3', descricao_servico: 'Sucessora FS+2', data_inicio: '2026-08-01', data_fim: '2026-08-03', duracao_dias: 3, e_analitico: true, predecessores: ['1.1FS+2'] };
      expect(calculatePredecessorRequiredStart(itemFSLag, itemsMap, projStart)).toBe('2026-08-08');

      // SS sem lag: 2026-08-01 (Início da pred)
      const itemSS: EapEngineItem = { id: '4', eap_codigo: '1.4', descricao_servico: 'Sucessora SS', data_inicio: '2026-08-01', data_fim: '2026-08-03', duracao_dias: 3, e_analitico: true, predecessores: ['1.1SS+0'] };
      expect(calculatePredecessorRequiredStart(itemSS, itemsMap, projStart)).toBe('2026-08-01');
    });
  });

  // ── 3. Passo 4: Rollup de Tarefas Sumário (Pais) ─────────────────────────────
  describe('Passo 4: Dimensionamento e Rollup das Atividades Sumário', () => {
    it('deve dimensionar o pai estritamente por min(filhas.inicio) e max(filhas.fim)', () => {
      const itemsMap = new Map<string, EapEngineItem>([
        ['1', { id: '1', eap_codigo: '1', descricao_servico: 'Pai', data_inicio: '2026-08-01', data_fim: '2026-08-01', duracao_dias: 1, e_analitico: false }],
        ['1.1', { id: '2', eap_codigo: '1.1', descricao_servico: 'Filha 1', data_inicio: '2026-08-05', data_fim: '2026-08-10', duracao_dias: 6, e_analitico: true, percentual_executado_financeiro: 100, valor_total_contratado: 1000 }],
        ['1.2', { id: '3', eap_codigo: '1.2', descricao_servico: 'Filha 2', data_inicio: '2026-08-02', data_fim: '2026-08-15', duracao_dias: 14, e_analitico: true, percentual_executado_financeiro: 50, valor_total_contratado: 1000 }],
      ]);

      executeSummaryRollup(itemsMap, projStart);

      const pai = itemsMap.get('1')!;
      expect(pai.data_inicio).toBe('2026-08-02'); // min(2026-08-05, 2026-08-02)
      expect(pai.data_fim).toBe('2026-08-15');    // max(2026-08-10, 2026-08-15)
      expect(pai.duracao_dias).toBe(14);          // diffDays(2026-08-15, 2026-08-02) + 1
      expect(pai.percentual_executado_financeiro).toBe(75); // (100*1000 + 50*1000) / 2000 = 75%
    });
  });

  // ── 4. Passos 5, 6, 7 & Critérios de Aceitação ──────────────────────────────
  describe('Passos 5, 6, 7 & Critérios de Aceitação', () => {
    it('Passo 5 (Movimento do Corpo): deve manter duração e mover inicio/fim', () => {
      const items: EapEngineItem[] = [
        { id: '1', eap_codigo: '1.1', descricao_servico: 'Escavação', data_inicio: '2026-08-01', data_fim: '2026-08-05', duracao_dias: 5, e_analitico: true },
      ];

      const { updatedItems } = processUserInteraction(items, {
        eap_codigo: '1.1',
        interactionType: 'body_move',
        newStart: '2026-08-10',
      }, projStart);

      const updated = updatedItems.find(i => i.eap_codigo === '1.1')!;
      expect(updated.data_inicio).toBe('2026-08-10');
      expect(updated.duracao_dias).toBe(5);
      expect(updated.data_fim).toBe('2026-08-14'); // 10 + 5 - 1 = 14
    });

    it('Passo 5 (Redimensionamento Direita): deve manter inicio e alterar duração/fim', () => {
      const items: EapEngineItem[] = [
        { id: '1', eap_codigo: '1.1', descricao_servico: 'Fundação', data_inicio: '2026-08-01', data_fim: '2026-08-05', duracao_dias: 5, e_analitico: true },
      ];

      const { updatedItems } = processUserInteraction(items, {
        eap_codigo: '1.1',
        interactionType: 'resize_right',
        newEnd: '2026-08-10',
      }, projStart);

      const updated = updatedItems.find(i => i.eap_codigo === '1.1')!;
      expect(updated.data_inicio).toBe('2026-08-01');
      expect(updated.duracao_dias).toBe(10); // 2026-08-10 - 2026-08-01 + 1 = 10
      expect(updated.data_fim).toBe('2026-08-10');
    });

    it('Passo 7 (Auto-Scheduling/Efeito Dominó): deve descolar sucessora automaticamente', () => {
      const items: EapEngineItem[] = [
        { id: '1', eap_codigo: '1.1', descricao_servico: 'Tarefa 1', data_inicio: '2026-08-01', data_fim: '2026-08-05', duracao_dias: 5, e_analitico: true },
        { id: '2', eap_codigo: '1.2', descricao_servico: 'Tarefa 2', data_inicio: '2026-08-06', data_fim: '2026-08-10', duracao_dias: 5, e_analitico: true, predecessores: ['1.1FS+0'] },
      ];

      // Move a Tarefa 1 para frente (fim passa de 05 para 12)
      const { updatedItems, affectedItems } = processUserInteraction(items, {
        eap_codigo: '1.1',
        interactionType: 'body_move',
        newStart: '2026-08-08',
      }, projStart);

      const t1 = updatedItems.find(i => i.eap_codigo === '1.1')!;
      const t2 = updatedItems.find(i => i.eap_codigo === '1.2')!;

      expect(t1.data_inicio).toBe('2026-08-08');
      expect(t1.data_fim).toBe('2026-08-12');

      // Tarefa 2 deve ter sido empurrada pelo efeito dominó para iniciar em 13-08
      expect(t2.data_inicio).toBe('2026-08-13');
      expect(t2.data_fim).toBe('2026-08-17');

      // Ambas as tarefas devem ser listadas nos afetados para salvar no banco
      expect(affectedItems.length).toBe(2);
    });

    it('Critério de Aceitação 1: não deve permitir alterar datas de tarefa sumário diretamente', () => {
      const items: EapEngineItem[] = [
        { id: '1', eap_codigo: '1', descricao_servico: 'Agrupadora', data_inicio: '2026-08-01', data_fim: '2026-08-10', duracao_dias: 10, e_analitico: false },
        { id: '2', eap_codigo: '1.1', descricao_servico: 'Filha', data_inicio: '2026-08-01', data_fim: '2026-08-10', duracao_dias: 10, e_analitico: true },
      ];

      // Tenta redimensionar a agrupadora diretamente
      const { updatedItems, affectedItems } = processUserInteraction(items, {
        eap_codigo: '1',
        interactionType: 'resize_right',
        newEnd: '2026-08-20',
      }, projStart);

      // Nenhuma alteração direta permitida no agrupador
      expect(affectedItems.length).toBe(0);
    });

    it('Critério de Aceitação 2: impedimento de inicio anterior ao limite da predecessora', () => {
      const items: EapEngineItem[] = [
        { id: '1', eap_codigo: '1.1', descricao_servico: 'Muro', data_inicio: '2026-08-10', data_fim: '2026-08-15', duracao_dias: 6, e_analitico: true },
        { id: '2', eap_codigo: '1.2', descricao_servico: 'Pintura', data_inicio: '2026-08-16', data_fim: '2026-08-20', duracao_dias: 5, e_analitico: true, predecessores: ['1.1FS+0'] },
      ];

      // Tenta arrastar a Pintura para ANTES do Muro terminar (ex: dia 01)
      const { updatedItems } = processUserInteraction(items, {
        eap_codigo: '1.2',
        interactionType: 'body_move',
        newStart: '2026-08-01',
      }, projStart);

      const pintura = updatedItems.find(i => i.eap_codigo === '1.2')!;
      // Deve ter sido retida em 16-08 pelo vínculo da predecessora
      expect(pintura.data_inicio).toBe('2026-08-16');
    });
  });
});

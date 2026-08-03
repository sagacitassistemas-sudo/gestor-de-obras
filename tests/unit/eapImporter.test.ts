import { describe, it, expect } from 'vitest';
import {
  parseEapMarkdown,
  alignTableSchemaInMemory,
  simulateEapTestEnvironment,
  parseNumber,
  deriveParentCode,
  compareEapCodes
} from '../../src/services/eapImporter.service';

describe('EAP Importer Unit Tests', () => {

  describe('Helpers', () => {
    it('should correctly parse numbers in Brazilian and standard formats', () => {
      expect(parseNumber('1.234,56')).toBe(1234.56);
      expect(parseNumber('100,50')).toBe(100.50);
      expect(parseNumber('500.00')).toBe(500.00);
      expect(parseNumber('R$ 2.500,00')).toBe(2500.00);
      expect(parseNumber(42)).toBe(42);
      expect(parseNumber(null)).toBe(0);
    });

    it('should derive parent code correctly', () => {
      expect(deriveParentCode('1.2.3')).toBe('1.2');
      expect(deriveParentCode('1.2')).toBe('1');
      expect(deriveParentCode('1')).toBe(null);
    });

    it('should sort EAP codes in natural numerical level and sub-level order', () => {
      const unsorted = ['2.1', '1.10', '1.2', '1.1.1', '1', '1.1', '1.10.1', '2'];
      const sorted = [...unsorted].sort(compareEapCodes);

      expect(sorted).toEqual([
        '1',
        '1.1',
        '1.1.1',
        '1.2',
        '1.10',
        '1.10.1',
        '2',
        '2.1'
      ]);
    });
  });

  describe('Etapa 1: Leitura (.md)', () => {
    it('should parse Markdown table with Desembolsado column into structured EAP items', () => {
      const mdTable = `
| Código EAP | Descrição / Serviço | Unidade | Preço Unit. | Qtd Contratada | Desembolsado |
|---|---|---|---|---|---|
| 1 | SERVIÇOS PRELIMINARES | | | | |
| 1.1 | Canteiro de Obras | m² | 150,00 | 10 | 500,00 |
`;
      const { items } = parseEapMarkdown(mdTable);
      expect(items).toHaveLength(2);
      expect(items[1].valor_desembolsado).toBe(500);

      const sim = simulateEapTestEnvironment('proj-123', items, ['Código EAP', 'Descrição / Serviço', 'Unidade', 'Preço Unit.', 'Qtd Contratada', 'Desembolsado'], []);
      expect(sim.items[0].valor_desembolsado).toBe(500);
    });

    it('should parse Markdown table into structured EAP items', () => {
      const mdTable = `
| Código EAP | Descrição / Serviço | Unidade | Preço Unit. | Qtd Contratada | Categoria |
|---|---|---|---|---|---|
| 1 | SERVIÇOS PRELIMINARES | | | | Infra |
| 1.1 | Canteiro de Obras | | | | Infra |
| 1.1.1 | Barracão em Madeira | m² | 150,00 | 20 | Instalações |
| 1.1.2 | Ligação Provisória de Água | un | 1.200,00 | 1 | Instalações |
`;
      const { items, rawHeaders } = parseEapMarkdown(mdTable);

      expect(rawHeaders).toContain('Código EAP');
      expect(rawHeaders).toContain('Categoria');
      expect(items).toHaveLength(4);

      expect(items[0].eap_codigo).toBe('1');
      expect(items[0].descricao_servico).toBe('SERVIÇOS PRELIMINARES');
      expect(items[0].eap_pai_codigo).toBeNull();

      expect(items[2].eap_codigo).toBe('1.1.1');
      expect(items[2].eap_pai_codigo).toBe('1.1');
      expect(items[2].unidade_medida).toBe('m²');
      expect(items[2].preco_unitario).toBe(150.00);
      expect(items[2].quantidade_contratada).toBe(20);
      expect(items[2].valor_total_contratado).toBe(3000.00);
      expect(items[2].campos_adicionais?.['Categoria']).toBe('Instalações');
    });

    it('should parse Markdown tree lists into EAP items', () => {
      const mdList = `
# 1. SERVIÇOS PRELIMINARES
- 1.1 Mobiliário Provisório
  - 1.1.1 Mesa para escritório - Un: un, Qtd: 2, Preço: 250.00
`;
      const { items } = parseEapMarkdown(mdList);

      expect(items).toHaveLength(3);
      expect(items[0].eap_codigo).toBe('1');
      expect(items[2].eap_codigo).toBe('1.1.1');
      expect(items[2].quantidade_contratada).toBe(2);
      expect(items[2].preco_unitario).toBe(250.00);
      expect(items[2].valor_total_contratado).toBe(500.00);
    });
  });

  describe('Etapa 2: Ajustes das tabelas no BD em memória', () => {
    it('should separate mapped standard DB columns from new custom columns', () => {
      const rawHeaders = ['Código EAP', 'Descrição', 'Unidade', 'Preço Unit.', 'Qtd', 'Responsável Téorico', 'Centro de Custo'];
      const mdTable = `
| Código EAP | Descrição | Unidade | Preço Unit. | Qtd | Responsável Téorico | Centro de Custo |
|---|---|---|---|---|---|---|
| 1.1 | Escavação | m³ | 30,00 | 100 | Eng. João | CC-102 |
`;
      const { items } = parseEapMarkdown(mdTable);
      const schema = alignTableSchemaInMemory(rawHeaders, items);

      expect(schema.mappedColumns).toContain('Código EAP');
      expect(schema.mappedColumns).toContain('Descrição');
      expect(schema.newCustomColumns).toContain('Responsável Téorico');
      expect(schema.newCustomColumns).toContain('Centro de Custo');
    });
  });

  describe('Etapa 3 & 4: Ambiente de teste & Modelo Interpretado', () => {
    it('should classify synthetic vs analytic items and calculate rollups', () => {
      const mdTable = `
| Código EAP | Descrição | Unidade | Preço Unit. | Qtd |
|---|---|---|---|---|
| 1 | SERVIÇOS PRELIMINARES | | 0 | 0 |
| 1.1 | Instalações Provisórias | | 0 | 0 |
| 1.1.1 | Barracão | m² | 100.00 | 10 |
| 1.1.2 | Tapume | m | 50.00 | 20 |
`;
      const { items, rawHeaders } = parseEapMarkdown(mdTable);
      const simulation = simulateEapTestEnvironment('proj-123', items, rawHeaders, []);

      expect(simulation.valid).toBe(true);
      expect(simulation.metrics.totalItems).toBe(4);
      expect(simulation.metrics.syntheticCount).toBe(2);
      expect(simulation.metrics.analyticCount).toBe(2);

      // Item 1.1.1: 100 * 10 = 1000
      // Item 1.1.2: 50 * 20 = 1000
      // Item 1.1 rollup: 2000
      // Item 1 rollup: 2000
      expect(items.find(i => i.eap_codigo === '1.1.1')?.valor_total_contratado).toBe(1000);
      expect(items.find(i => i.eap_codigo === '1.1.2')?.valor_total_contratado).toBe(1000);
      expect(items.find(i => i.eap_codigo === '1.1')?.valor_total_contratado).toBe(2000);
      expect(items.find(i => i.eap_codigo === '1')?.valor_total_contratado).toBe(2000);
      expect(simulation.metrics.totalContractValue).toBe(2000);
    });

    it('should warn when a parent code is missing', () => {
      const mdTable = `
| Código EAP | Descrição |
|---|---|
| 2.1.1 | Item sem pai 2.1 |
`;
      const { items, rawHeaders } = parseEapMarkdown(mdTable);
      const simulation = simulateEapTestEnvironment('proj-123', items, rawHeaders, []);

      expect(simulation.issues).toHaveLength(1);
      expect(simulation.issues[0].code).toBe('MISSING_PARENT');
    });

    it('should identify NEW vs UPDATE items based on existing database records', () => {
      const mdTable = `
| Código EAP | Descrição | Unidade | Preço | Qtd |
|---|---|---|---|---|
| 1.1 | Item Existente | un | 10 | 5 |
| 1.2 | Item Novo | un | 20 | 5 |
`;
      const existingDb = [
        { id: 'uuid-1', eap_codigo: '1.1', descricao_servico: 'Antigo' }
      ];

      const { items, rawHeaders } = parseEapMarkdown(mdTable);
      const simulation = simulateEapTestEnvironment('proj-123', items, rawHeaders, existingDb);

      expect(simulation.metrics.newItemsCount).toBe(1);
      expect(simulation.metrics.updateItemsCount).toBe(1);
      expect(items.find(i => i.eap_codigo === '1.1')?.action).toBe('UPDATE');
      expect(items.find(i => i.eap_codigo === '1.1')?.id).toBe('uuid-1');
      expect(items.find(i => i.eap_codigo === '1.2')?.action).toBe('NEW');
    });

    it('should parse real-world migracao_dados.md file', () => {
      const fs = require('fs');
      const mdContent = fs.readFileSync('docs/migracao_dados.md', 'utf-8');
      const { items, rawHeaders } = parseEapMarkdown(mdContent);
      const simulation = simulateEapTestEnvironment('proj-123', items, rawHeaders, []);

      expect(items.length).toBeGreaterThan(10);
      expect(simulation.valid).toBe(true);
    });
  });
});

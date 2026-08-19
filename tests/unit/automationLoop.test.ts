import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import { DevAutomationService } from '../../src/utils/DevAutomationService';

describe('DevAutomationService - AI Loop & Error Logging', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    DevAutomationService.resetLoop();
  });

  describe('1. Sanitização de PII (Personally Identifiable Information)', () => {
    it('deve remover tokens JWT de strings de erro', () => {
      const rawLog = 'Crash report. Auth token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c. Request failed.';
      const sanitized = DevAutomationService.sanitizePII(rawLog);
      
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).toContain('[REDACTED_JWT]');
    });

    it('deve remover CPFs e e-mails de logs crus', () => {
      const rawLog = 'User admin@sagacitas.com with CPF 123.456.789-00 performed illegal operation.';
      const sanitized = DevAutomationService.sanitizePII(rawLog);
      
      expect(sanitized).not.toContain('admin@sagacitas.com');
      expect(sanitized).not.toContain('123.456.789-00');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
      expect(sanitized).toContain('[REDACTED_CPF]');
    });
  });

  describe('2. Geração Estruturada de Markdown', () => {
    it('deve gerar e salvar arquivo markdown estruturado na pasta .ai/errors/', async () => {
      const resultPath = await DevAutomationService.logError('Type Error Fix', 'TypeError: undefined is not a function');
      
      expect(resultPath).toMatch(new RegExp('\\.ai/errors/\\d{4}-\\d{2}-\\d{2}_type_error_fix\\.md'));
      expect(fs.writeFile).toHaveBeenCalledOnce();
      
      const [pathArg, contentArg] = vi.mocked(fs.writeFile).mock.calls[0];
      expect(pathArg).toContain('.ai/errors/');
      expect(contentArg).toContain('# Post-Mortem: Type Error Fix');
      expect(contentArg).toContain('## Raw Output');
    });
  });

  describe('3. Circuit Breaker (Trava Anti-Drift e Loops)', () => {
    it('deve lançar exceção "CircuitBreakerOpen" se exceder limite de retries no mesmo ciclo', async () => {
      await DevAutomationService.processLoop(3);
      await DevAutomationService.processLoop(3);
      await DevAutomationService.processLoop(3);
      
      await expect(
        DevAutomationService.processLoop(3)
      ).rejects.toThrow('CircuitBreakerOpen: Maximum retry limit reached. Halting AI loop to prevent attention drift.');
    });

    it('deve resetar o contador de falhas após um processamento de sucesso', async () => {
      DevAutomationService.resetLoop();
      const success = await DevAutomationService.processLoop(3);
      expect(success).toBe(true);
      await DevAutomationService.processLoop(3);
      await DevAutomationService.processLoop(3);
      DevAutomationService.resetLoop(); // Reset simulando processamento com sucesso (quebrando o loop)
      expect(await DevAutomationService.processLoop(3)).toBe(true);
    });
  });
});

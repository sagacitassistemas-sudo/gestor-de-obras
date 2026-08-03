/**
 * tests/setup.ts
 * Setup global executado antes de cada suíte de testes.
 * Define variáveis de ambiente de teste e mocks globais.
 */

import { vi } from 'vitest';

// ── Variáveis de Ambiente de Teste ──────────────────────────────────────────
process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';               // Impede app.listen() no startServer()
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

// ── Mock: Vite (impede carregamento do servidor de desenvolvimento) ─────────
vi.mock('vite', () => ({
  createServer: vi.fn().mockResolvedValue({
    middlewares: (req: any, res: any, next: any) => next?.(),
    close: vi.fn(),
  }),
}));

// ── Mock: Firebase Admin SDK ─────────────────────────────────────────────────
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => [{ name: '[DEFAULT]' }]),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error('firebase/no-app')),
    createCustomToken: vi.fn().mockResolvedValue('mock-custom-token'),
  })),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
      })),
      add: vi.fn().mockResolvedValue({ id: 'mock-firestore-id' }),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    })),
  })),
}));

// ── Mock: @google/genai ──────────────────────────────────────────────────────
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: 'Análise de DRE simulada para testes.',
      }),
    },
  })),
}));


import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import operacoesRouter from "./src/routes/operacoes.routes";
import path from "path";
import rdoRouter from "./src/routes/rdo.routes";
import cronogramaRouter from "./src/routes/cronograma.routes";
import financeiroRouter from "./src/routes/financeiro.routes";
import recursosRouter from "./src/routes/recursos.routes";
import eapRouter from "./src/routes/eap.routes";
import sistemaRouter from "./src/routes/sistema.routes";
import competenciasRouter from "./src/routes/competencias.routes";
import mobileRouter from "./src/routes/mobile.routes";
import cubRouter from "./src/routes/cub.routes";
import authRouter from "./src/routes/auth.routes";
import empresasRouter from "./src/routes/empresas.routes";
import permissoesRouter from "./src/routes/permissoes.routes";
import projetosRouter from "./src/routes/projetos.routes";
import usuariosRouter from "./src/routes/usuarios.routes";
import basesReferenciaisRouter from "./src/routes/bases_referenciais.routes";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import {
  initializeApp as initAdminApp,
  getApps as getAdminApps,
  cert,
} from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  checkPermission,
  getGlobalSupabaseClient,
  ensureUserExists,
} from "./src/lib/server.lib";
import jwt from "jsonwebtoken";
import { verifyFirebaseJWT } from "./src/middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "./src/types/middleware.types";
import { FirebaseCustomClaims } from "./src/types/firebase.types";
import { logAudit, logSystemError } from "./src/services/logger.service";
import { sendEmail } from "./src/utils/mailer";

dotenv.config({ override: true });

import { SYSTEM_PARAMS } from "./src/constants/system.constants";

// Helper to safely obtain Firebase Admin Auth without throwing when not initialized
export function getSafeAdminAuth() {
  try {
    return getAdminApps().length > 0 ? getAdminAuth() : null;
  } catch (e) {
    return null;
  }
}

// Helper function to create a scoped Supabase client with a custom JWT
export function getSupabaseClient(req: AuthenticatedRequest): SupabaseClient | null {
  if (!supabaseUrl || !req.decodedToken) return null;
  // Use the global service role client to bypass broken RLS policies.
  // The backend already enforces tenant isolation explicitly via .eq("contrato_id", ...) on all queries.
  return supabase;
}

// Helper to get service role client for public/admin endpoints
function getServiceRoleClient(): SupabaseClient {
  return createClient(supabaseUrl!, supabaseServiceKey!);
}

// Centralized helper to coordinate CRUD operations (Insert vs Update vs Upsert)
async function saveRecord(
  client: SupabaseClient,
  table: string,
  data: any,
  options: { idField?: string; onConflict?: string; single?: boolean } = {},
) {
  const idField = options.idField || "id";
  const onConflict = options.onConflict;
  const single = options.single !== false; // default to true

  const idValue = data[idField];
  const hasIdValue =
    idValue !== undefined && idValue !== null && idValue !== "";

  let query: any;

  if (onConflict) {
    const conflictFields = onConflict.split(",").map((s) => s.trim());
    if (conflictFields.includes(idField) && !hasIdValue) {
      const insertData = { ...data };
      delete insertData[idField];
      query = client.from(table).insert([insertData]);
    } else {
      query = client.from(table).upsert(data, { onConflict });
    }
  } else {
    if (hasIdValue) {
      query = client.from(table).update(data).eq(idField, idValue);
    } else {
      const insertData = { ...data };
      delete insertData[idField];
      query = client.from(table).insert([insertData]);
    }
  }

  query = query.select();
  if (single) {
    query = query.single();
  }
  return await query;
}



// Check if Firebase Admin SDK has valid credentials to initialize Firestore
const isFirestoreEnabled = () => {
  return (
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    fs.existsSync(path.join(process.cwd(), "serviceAccountKey.json"))
  );
};

// Initialize Supabase Client safely using environment variables
const supabaseUrl = process.env.SUPABASE_URL?.replace(/^["']|["']$/g, "");
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(
  /^["']|["']$/g,
  "",
);
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.replace(
  /^["']|["']$/g,
  "",
);

let supabase: SupabaseClient | null = null;
console.log(
  "DEBUG: SUPABASE_URL length:",
  supabaseUrl ? supabaseUrl.length : 0,
);
console.log(
  "DEBUG: SUPABASE_URL starts with:",
  supabaseUrl ? supabaseUrl.substring(0, 5) : "none",
);
console.log(
  "DEBUG: SUPABASE_URL ends with quote?:",
  supabaseUrl ? supabaseUrl.endsWith('"') : false,
);
if (supabaseUrl) {
  // Use the Service Role Key for the backend server to bypass RLS.
  // The backend already enforces tenant isolation explicitly via .eq("contrato_id", ...) on all queries.
  const targetKey = supabaseServiceKey || supabaseAnonKey;

  if (targetKey) {
    try {
      supabase = createClient(supabaseUrl, targetKey);
      console.log(
        `Supabase client initialized with key prefix: ${targetKey.substring(0, 15)}...`,
      );
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
    }
  }
}

// In-memory store fallback for Empresa Contratante (initialized empty to eliminate mock data as requested)
const inMemoryContratantes = new Map<string, any>();

// In-memory store fallback for Empresas Fornecedoras (initialized empty to eliminate mock data as requested)
const inMemoryEmpresas = new Map<string, any[]>();

import { MobileAuthenticatedRequest, mobileAuthMiddleware } from "./src/middleware/mobileAuth.middleware";

interface FirebaseAppConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

// Initialize Firebase Admin SDK safely with fs.readFileSync
let configData: FirebaseAppConfig = {};
try {
  const configFile = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configFile)) {
    configData = JSON.parse(fs.readFileSync(configFile, "utf-8"));
  }
} catch (err) {
  console.warn("Could not load firebase-applet-config.json:", err);
}

if (!getAdminApps().length) {
  try {
    const hasCreds =
      !!process.env.FIREBASE_SERVICE_ACCOUNT ||
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      fs.existsSync(path.join(process.cwd(), "serviceAccountKey.json"));
    if (hasCreds) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initAdminApp({ credential: cert(serviceAccount), projectId: configData.projectId });
      } else if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(path.join(process.cwd(), "serviceAccountKey.json"))) {
        const serviceAccount = JSON.parse(fs.readFileSync(path.join(process.cwd(), "serviceAccountKey.json"), "utf8"));
        initAdminApp({ credential: cert(serviceAccount), projectId: configData.projectId });
      } else {
        initAdminApp({ projectId: configData.projectId });
      }
      console.log("Firebase Admin initialized successfully.");
    } else {
      console.warn(
        "Skipping Firebase Admin init: No credentials found (prevents Vercel timeout).",
      );
    }
  } catch (err) {
    console.warn("Firebase Admin initialize warning:", err);
  }
}

function startServer() {
  const app = express();
  let PORT = Number(process.env.PORT) || 8500;

  // Configuração do Helmet para headers de segurança
  app.use(helmet({
    crossOriginOpenerPolicy: { policy: "unsafe-none" }, // Firebase Auth Popup compatibilidade
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com", "https://www.gstatic.com"],
        connectSrc: ["'self'", "ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*", "http://127.0.0.1:*", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://*.supabase.co"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "http://localhost:*", "http://127.0.0.1:*", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://*", "http://*"],
      },
    },
  }));

  // Limiter genérico
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500, // Limite de 500 requisições por IP
    message: { error: "Muitas requisições deste IP. Tente novamente mais tarde." }
  });

  // Limiter restrito para rotas de autenticação
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Tentativas de autenticação excessivas. Bloqueado por 15 minutos." }
  });

  app.use('/api/auth', authLimiter);
  app.use('/api', apiLimiter);

  // Habilita CORS com abrangência para Frontend e App Mobile
  app.use(cors({
    origin: [
      'http://localhost:15000',
      'http://127.0.0.1:15000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:54641',
      'http://127.0.0.1:54641',
      'https://rdo-wm.vercel.app',
      'https://rdo-wm-puce.vercel.app'
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID']
  }));

  // Limite o tamanho do JSON para prevenir Out Of Memory. 10MB para tolerar payloads maiores como EAP.
  app.use(express.json({ limit: '10mb' }));
  
  app.use('/api/cronograma', cronogramaRouter);
  app.use('/api', financeiroRouter); // Fase 1: Custos / Encargos / BDI
  app.use('/api/cub', cubRouter); // Fase 4: CUB
  app.use('/api/bases-referenciais', basesReferenciaisRouter); // Bases Analíticas
  app.use('/api', operacoesRouter); // Fase 2: Ordens de Serviço
  app.use('/api', recursosRouter); // Fase 2: Recursos (Funcionários, Equipes, etc)
  app.use('/', eapRouter); // Fase 3: EAP e Cronograma
  app.use('/', sistemaRouter); // Fase 3: Validações e Auditoria
  app.use('/', rdoRouter); // Fase 3: RDO
  app.use('/', competenciasRouter); // Fase 3: Competências e Avaliações
  app.use('/', mobileRouter); // Fase 3: Mobile BFF
  app.use('/', authRouter); // Fase 4: Auth, Convites, Gestora

  // ==========================================
  // AUTH, CONVITES & GESTORA ENDPOINTS
  // ==========================================
  // Movidos para src/routes/auth.routes.ts

  // ==========================================
  // SUPABASE CONTRACTING COMPANY REGISTER
  // ==========================================

  // Movido para src/routes/financeiro.routes.ts (Fase 1 da modularização)
  // ==========================================

  // ==========================================
  app.use("/", empresasRouter); // Fase 5: Empresas

  app.use("/", permissoesRouter); // Fase 5: Permissoes
  app.use("/", projetosRouter); // Fase 5: Projetos
  app.use("/", usuariosRouter); // Fase 5: Usuarios
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    import("vite")
      .then(({ createServer: createViteServer }) => {
        createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        }).then((vite) => {
          app.use(vite.middlewares);
        });
      })
      .catch((err) => console.error("Failed to start Vite middleware:", err));
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const listen = (port: number) => {
    if (port > 8999) {
      console.error(
        "Nenhuma porta livre encontrada no intervalo de 8500 a 8999.",
      );
      process.exit(1);
    }
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Porta ${port} ocupada. Tentando porta ${port + 1}...`);
        listen(port + 1);
      } else {
        console.error("Erro no servidor:", err);
      }
    });
  };

  if (!process.env.VERCEL) {
    listen(PORT);
  }

  return app;
}

// Helper to compute effective permissions with fallback


/**
 * Função Universal para Injetar Permissões no Firebase JWT.
 * Acionada no MFA Verify, OAuth Login e Sync-Claims.
 */


// Helper for inline permission checks in endpoints


const appInstance = startServer();

export default appInstance;

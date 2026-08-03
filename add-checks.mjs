import fs from 'fs';

const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  {
    search: `  // GET /api/firestore/lancamentos\n  app.get("/api/firestore/lancamentos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n`,
    replace: `  // GET /api/firestore/lancamentos\n  app.get("/api/firestore/lancamentos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n    if (!(await checkPermission(req, 'financeiro_ler'))) return res.status(403).json({ error: "Acesso Restrito: Permissão 'financeiro_ler' requerida." });\n`
  },
  {
    search: `  // POST /api/firestore/lancamentos\n  app.post("/api/firestore/lancamentos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n`,
    replace: `  // POST /api/firestore/lancamentos\n  app.post("/api/firestore/lancamentos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n    const isUpdate = !!req.body.id;\n    const requiredPerm = isUpdate ? 'financeiro_editar' : 'financeiro_criar';\n    if (!(await checkPermission(req, requiredPerm))) return res.status(403).json({ error: \`Acesso Restrito: Permissão '\${requiredPerm}' requerida.\` });\n`
  },
  {
    search: `  // GET /api/usuarios - List all users\n  app.get("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n`,
    replace: `  // GET /api/usuarios - List all users\n  app.get("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n    if (!(await checkPermission(req, 'usuarios_ler'))) return res.status(403).json({ error: "Acesso Restrito: Permissão 'usuarios_ler' requerida." });\n`
  },
  {
    search: `  // POST /api/usuarios\n  app.post("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n`,
    replace: `  // POST /api/usuarios\n  app.post("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n    const isUpdate = !!req.body.id;\n    const requiredPerm = isUpdate ? 'usuarios_editar' : 'usuarios_criar';\n    if (!(await checkPermission(req, requiredPerm))) return res.status(403).json({ error: \`Acesso Restrito: Permissão '\${requiredPerm}' requerida.\` });\n`
  },
  {
    search: `  // DELETE /api/usuarios\n  app.delete("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n`,
    replace: `  // DELETE /api/usuarios\n  app.delete("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {\n    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });\n    if (!(await checkPermission(req, 'usuarios_excluir'))) return res.status(403).json({ error: "Acesso Restrito: Permissão 'usuarios_excluir' requerida." });\n`
  }
];

for (const { search, replace } of replacements) {
  content = content.replace(search, replace);
}

fs.writeFileSync(file, content);
console.log('Modified server.ts');

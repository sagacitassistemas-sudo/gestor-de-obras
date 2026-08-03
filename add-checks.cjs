const fs = require('fs');

const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

// Modifica /api/permissoes/efetivas/:uid
content = content.replace(
  /app\.get\("\/api\/permissoes\/efetivas\/:uid", verifyFirebaseJWT, async \(req: AuthenticatedRequest, res\) => {[\s\S]*?if \(!req\.decodedToken\) return res\.status\(401\)\.json\({ error: "Acesso não autorizado\." }\);[\s\S]*?try {[\s\S]*?const client = getSupabaseClient\(req\);[\s\S]*?if \(!client\) return res\.status\(500\)\.json\({ error: "Supabase não configurado\." }\);[\s\S]*?const uid = req\.params\.uid;[\s\S]*?const { data, error } = await client[\s\S]*?\.from\("v_permissoes_efetivas"\)[\s\S]*?\.select\("\*"\)[\s\S]*?\.eq\("usuario_uid", uid\)[\s\S]*?\.maybeSingle\(\);[\s\S]*?if \(error\) return res\.status\(400\)\.json\({ error: error\.message }\);[\s\S]*?return res\.json\({ success: true, data }\);/,
  `app.get("/api/permissoes/efetivas/:uid", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
    if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
    try {
      const uid = req.params.uid;
      const computed = await getComputedPermissions(req);
      return res.json({ success: true, data: computed });`
);

// Array de modificações de rotas
const mods = [
  { endpoint: 'app.get("/api/empresas"', perm: 'empresas_ler' },
  { endpoint: 'app.post("/api/empresas"', perm: 'isUpdate ? "empresas_editar" : "empresas_criar"' },
  { endpoint: 'app.delete("/api/empresas"', perm: 'empresas_excluir' },
  { endpoint: 'app.get("/api/projetos"', perm: 'projetos_ler' },
  { endpoint: 'app.post("/api/projetos"', perm: 'isUpdate ? "projetos_editar" : "projetos_criar"' },
  { endpoint: 'app.delete("/api/projetos"', perm: 'projetos_excluir' },
  { endpoint: 'app.get("/api/itens-eap"', perm: 'projetos_ler' },
  { endpoint: 'app.post("/api/itens-eap"', perm: 'isUpdate ? "projetos_editar" : "projetos_criar"' },
  { endpoint: 'app.get("/api/contratos-obra"', perm: 'medicoes_ler' },
  { endpoint: 'app.post("/api/contratos-obra"', perm: 'isUpdate ? "medicoes_editar" : "medicoes_criar"' },
  { endpoint: 'app.get("/api/usuarios"', perm: 'usuarios_ler' },
  { endpoint: 'app.post("/api/usuarios"', perm: 'isUpdate ? "usuarios_editar" : "usuarios_criar"' },
  { endpoint: 'app.delete("/api/usuarios"', perm: 'usuarios_excluir' },
  { endpoint: 'app.get("/api/firestore/lancamentos"', perm: 'financeiro_ler' },
  { endpoint: 'app.post("/api/firestore/lancamentos"', perm: 'isUpdate ? "financeiro_editar" : "financeiro_criar"' },
  { endpoint: 'app.delete("/api/firestore/lancamentos"', perm: 'financeiro_excluir' },
];

for (const mod of mods) {
  // Regex to match the endpoint declaration and the immediate `if (!req.decodedToken) ...`
  // We insert the permission check right after the `if (!req.decodedToken) ... }` block
  
  const regex = new RegExp(`(${mod.endpoint.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\$&')}, verifyFirebaseJWT, async \\(req: AuthenticatedRequest, res\\) => {[\\s\\S]*?if \\(!req\\.decodedToken\\) {?[\\s\\S]*?return res\\.status\\(401\\)\\.json\\({ error: "Acesso não autorizado\\." }\\);\\s*}?)`);
  
  const isPostOrPut = mod.perm.includes('isUpdate');
  const checkStr = isPostOrPut 
    ? `\n    const isUpdate = !!req.body.id;\n    const reqPerm = ${mod.perm};\n    if (!(await checkPermission(req, reqPerm))) return res.status(403).json({ error: "Acesso Negado: Permissão " + reqPerm + " requerida." });`
    : `\n    if (!(await checkPermission(req, '${mod.perm}'))) return res.status(403).json({ error: "Acesso Negado: Permissão '${mod.perm}' requerida." });`;
    
  content = content.replace(regex, `$1${checkStr}`);
}

fs.writeFileSync(file, content);
console.log('Done modifying server.ts');

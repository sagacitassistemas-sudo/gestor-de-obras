const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');

function findLine(str) {
  return lines.findIndex(l => l.includes(str));
}

const pStart = findLine('// PERMISSIONS (HIERARCHICAL DELEGATION)');
const pEnd = findLine('// GET /api/contratos-obra');

if (pStart !== -1 && pEnd !== -1) {
  const extracted = lines.slice(pStart, pEnd).join('\n');
  
  const template = `import { Router } from "express";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import { getSupabaseClient, checkPermission } from "../lib/server.lib";

const router = Router();

${extracted.replace(/app\./g, 'router.')}

export default router;
`;

  fs.writeFileSync('src/routes/permissoes.routes.ts', template);
  
  lines.splice(pStart, pEnd - pStart);
  lines.splice(pStart, 0, '  app.use("/", permissoesRouter); // Fase 5: Permissoes');
  
  const importIndex = lines.findIndex(l => l.includes('import empresasRouter'));
  lines.splice(importIndex + 1, 0, 'import permissoesRouter from "./src/routes/permissoes.routes";');
  
  fs.writeFileSync('server.ts', lines.join('\n'));
  console.log('Extracted permissoes.routes.ts');
} else {
  console.log('Could not find boundaries for permissoes', pStart, pEnd);
}

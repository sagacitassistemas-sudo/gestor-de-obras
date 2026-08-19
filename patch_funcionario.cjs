const fs = require('fs');
const path = '/mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/src/middleware/mobileAuth.middleware.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /\.select\("id, empresa_id, email, tenant_id"\)/,
  '.select("id, empresa_id, email, tenant_id, nome, cargos(nome)")'
);

fs.writeFileSync(path, code);
console.log('mobileAuthMiddleware.ts patched');

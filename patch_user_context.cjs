const fs = require('fs');
const middlewarePath = '/mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/src/middleware/mobileAuth.middleware.ts';
let midCode = fs.readFileSync(middlewarePath, 'utf8');

midCode = midCode.replace(
  /empresa_id: string;\n  \};\n\}/,
  `empresa_id: string;
    nome?: string;
    cargo_nome?: string;
  };
}`
);

midCode = midCode.replace(
  /req\.userContext = \{\n\s*contrato_id: funcionario\.tenant_id,\n\s*funcionario_id: funcionario\.id,\n\s*empresa_id: funcionario\.empresa_id\n\s*\};/,
  `req.userContext = {
          contrato_id: funcionario.tenant_id,
          funcionario_id: funcionario.id,
          empresa_id: funcionario.empresa_id,
          nome: funcionario.nome,
          cargo_nome: funcionario.cargos?.nome
        };`
);

fs.writeFileSync(middlewarePath, midCode);

const serverPath = '/mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/server.ts';
let serverCode = fs.readFileSync(serverPath, 'utf8');

serverCode = serverCode.replace(
  /const \{ contrato_id: tenantId, funcionario_id, empresa_id \} = req\.userContext!;/g,
  `const { contrato_id: tenantId, funcionario_id, empresa_id, nome, cargo_nome } = req.userContext!;`
);

serverCode = serverCode.replace(
  /funcionario: \{ id: funcionario_id, empresa_id, empresa_nome: empresaData\.nome \},/g,
  `funcionario: { id: funcionario_id, empresa_id, empresa_nome: empresaData.nome, nome, cargo_nome },`
);

fs.writeFileSync(serverPath, serverCode);
console.log('Mobile endpoint enriched with full user profile');

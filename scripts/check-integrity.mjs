import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔍 Executando verificações de integridade e prevenção de regressões...\n');

let errorCount = 0;

// ===================================================================
// 1. CHECK: Paridade entre rotas da API (Frontend fetch vs Backend server.ts)
// ===================================================================
console.log('1️⃣ Verificando paridade de rotas HTTP (Frontend fetch vs Server endpoints)...');

const serverContent = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const srcFiles = getAllFiles(path.join(process.cwd(), 'src'));
const apiFetchRegex = /fetch\s*\(\s*['"`](\/api\/[^'"`?#]+)['"`]/g;
const missingRoutes = new Set();

srcFiles.forEach((filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  let match;
  while ((match = apiFetchRegex.exec(content)) !== null) {
    let rawRoute = match[1];
    // Normalizar parâmetros dinâmicos ${id}
    let routeBase = rawRoute.replace(/\$\{[^}]+\}/g, '').replace(/\/+$/, '');
    
    // Obter parte do caminho relevante (ex: /api/permissoes/tipo -> permissoes/tipo)
    const routePattern = routeBase.replace(/^\/api\//, '');

    if (routePattern && !serverContent.includes(routePattern)) {
      const relPath = path.relative(process.cwd(), filePath);
      missingRoutes.add(`- Rota '${rawRoute}' chamada em '${relPath}' não foi encontrada em server.ts`);
    }
  }
});

if (missingRoutes.size > 0) {
  console.error('  ❌ Rotas da API consumidas no Frontend mas ausentes no server.ts:');
  missingRoutes.forEach((msg) => console.error(`     ${msg}`));
  errorCount += missingRoutes.size;
} else {
  console.log('  ✅ Todas as chamadas fetch("/api/...") do frontend possuem handler cadastrado em server.ts.');
}

// ===================================================================
// 2. CHECK: Configuração do Cliente Supabase no Frontend (Sem conflitos com Firebase Auth)
// ===================================================================
console.log('\n2️⃣ Verificando isolamento de Autenticação do Supabase Client...');
const supabaseClientPath = path.join(process.cwd(), 'src/lib/supabaseClient.ts');
if (fs.existsSync(supabaseClientPath)) {
  const supabaseClientContent = fs.readFileSync(supabaseClientPath, 'utf-8');
  if (
    !supabaseClientContent.includes('persistSession: false') ||
    !supabaseClientContent.includes('autoRefreshToken: false')
  ) {
    console.error('  ❌ src/lib/supabaseClient.ts precisa ter persistSession: false e autoRefreshToken: false para evitar erros COOP / 400.');
    errorCount++;
  } else {
    console.log('  ✅ Supabase Client configurado corretamente com persistSession: false.');
  }
}

// ===================================================================
// 3. CHECK: Compilação e Tipagem Estrita (Props e Interfaces)
// ===================================================================
console.log('\n3️⃣ Testando compilação do TypeScript e validação de props (tsc --noEmit)...');
try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('  ✅ Compilação TypeScript limpa sem incompatibilidade de tipos ou props.');
} catch (err) {
  console.error('  ❌ Falha na verificação do TypeScript:');
  const stdout = err.stdout?.toString() || '';
  const stderr = err.stderr?.toString() || '';
  if (stdout) console.error(stdout.split('\n').slice(0, 15).join('\n'));
  if (stderr) console.error(stderr.split('\n').slice(0, 10).join('\n'));
  errorCount++;
}

// ===================================================================
// RESUMO DA INTEGRIDADE
// ===================================================================
console.log('\n======================================================');
if (errorCount > 0) {
  console.error(`❌ Verificação de Integridade FALHOU com ${errorCount} erro(s). Corrija antes de enviar para produção.`);
  process.exit(1);
} else {
  console.log('✨ Todas as verificações de prevenção de regressão PASSARAM com sucesso!');
  process.exit(0);
}

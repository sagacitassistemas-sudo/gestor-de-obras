import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const isVercel = process.env.VERCEL === '1' || process.env.CI === 'true' || process.env.VERCEL_ENV;

if (isVercel) {
  console.log('Ambiente CI/Vercel detectado, pulando verificação do Supabase Local.');
  process.exit(0);
}

const nativeCliPath = path.join(os.homedir(), '.local', 'bin', 'supabase');

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (err) {
    return null;
  }
}

function installSupabaseCli() {
  console.log('🔄 Instalando Supabase CLI nativa...');
  execSync('mkdir -p ~/.local/bin && curl -sL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz -C ~/.local/bin supabase', { stdio: 'inherit' });
  console.log('✅ Supabase CLI instalada.');
}

async function checkAndRepair() {
  console.log('🔍 Verificando integridade do Supabase Local...');

  if (!fs.existsSync(nativeCliPath)) {
    installSupabaseCli();
  }

  const supabaseCli = fs.existsSync(nativeCliPath) ? nativeCliPath : 'npx --yes supabase';

  const statusOutput = runCommand(`${supabaseCli} status`);
  
  if (!statusOutput || statusOutput.includes('not running')) {
    console.log('⚠️ Supabase local não está rodando. Iniciando...');
    execSync(`${supabaseCli} start`, { stdio: 'inherit' });
    return;
  }

  // Verifica se há containeres com status 'Restarting' ou 'unhealthy'
  const dockerPs = runCommand('docker ps --filter "name=supabase_" --format "{{.Status}}"');
  
  if (dockerPs && (dockerPs.includes('Restarting') || dockerPs.includes('unhealthy'))) {
    console.error('❌ Detectados containeres do Supabase em CrashLoop ou Unhealthy!');
    console.log('🔄 Realizando hard reset no ambiente do Supabase...');
    execSync(`${supabaseCli} stop`, { stdio: 'inherit' });
    execSync(`${supabaseCli} start`, { stdio: 'inherit' });
    console.log('✅ Supabase reiniciado com sucesso.');
  } else {
    console.log('✅ Supabase local está rodando e saudável.');
  }

  // Apply pending migrations
  console.log('📦 Aplicando migrations pendentes...');
  const pushResult = runCommand(`${supabaseCli} db push --local 2>&1`);
  if (pushResult && pushResult.includes('upToDate')) {
    console.log('✅ Banco de dados já está atualizado.');
  } else if (pushResult) {
    console.log('✅ Migrations aplicadas.');
  }

  // Reload PostgREST schema cache to prevent "column not found in schema cache" errors
  console.log('🔄 Recarregando schema cache do PostgREST...');
  runCommand('docker kill -s SIGUSR1 supabase_rest_gestor-de-obras 2>/dev/null');
  console.log('✅ Schema cache atualizado.');
}

checkAndRepair().catch(console.error);

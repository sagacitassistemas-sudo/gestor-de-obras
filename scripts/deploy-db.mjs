import { execSync } from 'child_process';

const isVercel = process.env.VERCEL === '1' || process.env.CI === 'true' || process.env.VERCEL_ENV;

try {
  if (!isVercel) {
    console.log('Ambiente local detectado. Executando db push --linked...');
    try {
      execSync('npx --yes supabase db push --linked', { stdio: 'inherit' });
    } catch (e) {
      console.log('npx supabase falhou, tentando usar binário nativo em ~/.local/bin/supabase...');
      execSync('~/.local/bin/supabase db push --linked', { stdio: 'inherit' });
    }
  } else {
    console.log('Ambiente Vercel (CI) detectado. Verificando credenciais para sincronismo do banco...');
    
    if (process.env.SUPABASE_DB_URL) {
      console.log('Sincronizando banco usando SUPABASE_DB_URL...');
      execSync(`npx --yes supabase db push --db-url "${process.env.SUPABASE_DB_URL}"`, { stdio: 'inherit' });
    } 
    else if (process.env.SUPABASE_PROJECT_ID && process.env.SUPABASE_ACCESS_TOKEN) {
      console.log('Sincronizando banco usando SUPABASE_PROJECT_ID...');
      execSync(`npx --yes supabase db push --project-ref ${process.env.SUPABASE_PROJECT_ID}`, { stdio: 'inherit' });
    } 
    else {
      console.warn('\n======================================================');
      console.warn('⚠️ AVISO: Sincronismo do Supabase Ignorado!');
      console.warn('Variáveis de ambiente SUPABASE_DB_URL ou (SUPABASE_PROJECT_ID + SUPABASE_ACCESS_TOKEN)');
      console.warn('não foram encontradas no Vercel.');
      console.warn('Por favor, adicione SUPABASE_DB_URL (string de conexão PostgreSQL) nas Environment Variables do Vercel.');
      console.warn('======================================================\n');
      // Saímos com 0 para não quebrar a pipeline do Vercel
      process.exit(0);
    }
  }
} catch (error) {
  console.error('\n❌ Erro durante o sincronismo do banco de dados:');
  console.error(error.message);
  // Se for ambiente Vercel e der erro de auth, avisa sem quebrar a build (opcional)
  // Mas como o usuário pediu para sincronizar, vamos falhar a build se tiver as chaves e falhar.
  process.exit(1);
}

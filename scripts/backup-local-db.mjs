import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Iniciando backup incremental do banco de dados local...');

const backupsDir = path.resolve('backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Formatar data: YYYY-MM-DD_HH-mm-ss
const now = new Date();
const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
const backupFilename = `data_backup_${timestamp}.sql`;
const backupPath = path.join(backupsDir, backupFilename);

try {
  console.log(`Gerando dump de dados para: backups/${backupFilename}`);
  
  // O Supabase CLI possui o comando db dump para gerar o snapshot de dados
  // Adicionamos um replace para tirar possíveis warnings do CLI no arquivo final se precisasse,
  // mas o --file já joga direto para o arquivo limpo.
  execSync(`npx supabase db dump --data-only --local --file "${backupPath}"`, { stdio: 'inherit' });

  // Também atualizamos o public_data.sql raiz para facilitar restaurar "o mais recente"
  console.log('Atualizando o public_data.sql principal...');
  fs.copyFileSync(backupPath, path.resolve('public_data.sql'));

  console.log('✅ Backup concluído com sucesso!');
  console.log(`Você pode versionar o arquivo public_data.sql e arquivar o backups/${backupFilename}`);
} catch (error) {
  console.error('❌ Erro ao gerar o backup:', error.message);
  process.exit(1);
}

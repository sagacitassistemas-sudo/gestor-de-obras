import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Restaurando os dados de teste locais...');

try {
  // Executa os arquivos SQL diretamente contra o banco local
  if (fs.existsSync(path.resolve('public_data.sql'))) {
    console.log('Restaurando public_data.sql...');
    execSync('cat public_data.sql | docker exec -i supabase_db_gestor-de-obras psql -U postgres', { stdio: 'inherit' });
  } else {
    console.warn('Arquivo public_data.sql não encontrado.');
  }

  if (fs.existsSync(path.resolve('eap_data.sql'))) {
    console.log('Restaurando eap_data.sql...');
    execSync('cat eap_data.sql | docker exec -i supabase_db_gestor-de-obras psql -U postgres', { stdio: 'inherit' });
  } else {
    console.warn('Arquivo eap_data.sql não encontrado.');
  }

  console.log('✅ Dados locais restaurados com sucesso!');
} catch (error) {
  console.error('❌ Erro ao restaurar os dados:', error.message);
  process.exit(1);
}

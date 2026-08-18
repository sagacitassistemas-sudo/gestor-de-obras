import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

const envLocal = dotenv.parse(fs.readFileSync('.env'));
const localSupabase = createClient(envLocal.SUPABASE_URL.replace(/['"]/g, '').trim(), envLocal.SUPABASE_SERVICE_ROLE_KEY.replace(/['"]/g, '').trim());

async function exportTableToSQL(tableName) {
  const { data, error } = await localSupabase.from(tableName).select('*');
  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return '';
  }
  
  if (!data || data.length === 0) return `-- No data in ${tableName}\n`;

  const keys = Object.keys(data[0]);
  
  const statements = data.map(row => {
    const values = keys.map(k => {
      if (row[k] === null) return 'NULL';
      if (typeof row[k] === 'string') return `'${row[k].replace(/'/g, "''")}'`;
      if (typeof row[k] === 'object') return `'${JSON.stringify(row[k]).replace(/'/g, "''")}'`;
      return row[k];
    });
    return `INSERT INTO public.${tableName} (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`;
  });

  return `-- Data for ${tableName}\n${statements.join('\n')}\n\n`;
}

async function main() {
  const tables = ['empresa_contratante', 'empresas_fornecedores', 'permissoes_usuario'];
  let sql = '';
  
  for (const table of tables) {
    sql += await exportTableToSQL(table);
  }

  fs.writeFileSync('migration_data.sql', sql);
  console.log('Successfully wrote data to migration_data.sql');
}

main().catch(console.error);

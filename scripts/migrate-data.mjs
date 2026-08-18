import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load local env
const envLocal = dotenv.parse(fs.readFileSync('.env'));
// Load prod env
const envProd = dotenv.parse(fs.readFileSync('.env.prod.temp'));

const prodSupabaseUrl = envProd.SUPABASE_URL.replace(/['"]/g, '').trim();
const prodSupabaseKey = envProd.SUPABASE_SERVICE_ROLE_KEY.replace(/['"]/g, '').trim();

const localSupabase = createClient(envLocal.SUPABASE_URL.replace(/['"]/g, '').trim(), envLocal.SUPABASE_SERVICE_ROLE_KEY.replace(/['"]/g, '').trim());
const prodSupabase = createClient(prodSupabaseUrl, prodSupabaseKey);

async function migrateTable(tableName) {
  console.log(`\n--- Migrating table ${tableName} ---`);
  
  // Fetch from local
  const { data: localData, error: localError } = await localSupabase
    .from(tableName)
    .select('*');

  if (localError) {
    console.error(`Error fetching ${tableName} from local:`, localError);
    return;
  }

  console.log(`Fetched ${localData.length} rows from local ${tableName}.`);

  if (localData.length === 0) return;

  // Insert/Upsert into prod
  const { data: prodData, error: prodError } = await prodSupabase
    .from(tableName)
    .upsert(localData)
    .select();

  if (prodError) {
    console.error(`Error upserting to prod ${tableName}:`, prodError);
  } else {
    console.log(`Successfully upserted ${prodData.length} rows into prod ${tableName}.`);
  }
}

async function main() {
  const tables = ['empresa_contratante', 'empresas_fornecedores', 'permissoes_usuario'];
  
  for (const table of tables) {
    await migrateTable(table);
  }
}

main().catch(console.error);

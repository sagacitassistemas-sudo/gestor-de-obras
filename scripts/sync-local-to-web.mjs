import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

console.log('🔄 Iniciando processo de sincronização de dados (Local -> Web)...\n');

// Carregar variáveis locais
const envLocal = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env')));

// Carregar variáveis de produção. Pode estar em .env.prod ou .env.prod.temp
let envProd;
if (fs.existsSync(path.resolve(process.cwd(), '.env.prod'))) {
  envProd = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env.prod')));
} else if (fs.existsSync(path.resolve(process.cwd(), '.env.prod.temp'))) {
  envProd = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env.prod.temp')));
} else {
  console.error('❌ ERRO: Arquivo .env.prod ou .env.prod.temp não encontrado.');
  process.exit(1);
}

const localUrl = envLocal.SUPABASE_URL?.replace(/['"]/g, '').trim();
const localKey = envLocal.SUPABASE_SERVICE_ROLE_KEY?.replace(/['"]/g, '').trim();

const prodUrl = envProd.SUPABASE_URL?.replace(/['"]/g, '').trim();
const prodKey = envProd.SUPABASE_SERVICE_ROLE_KEY?.replace(/['"]/g, '').trim();

if (!prodUrl || !prodKey) {
  console.error('❌ ERRO: Credenciais de produção ausentes (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no env de produção).');
  process.exit(1);
}

const localSupabase = createClient(localUrl, localKey, { auth: { persistSession: false } });
const prodSupabase = createClient(prodUrl, prodKey, { auth: { persistSession: false } });

// Ordem de tabelas para respeitar Chaves Estrangeiras
const tables = [
  'empresa_contratante',
  'empresas_fornecedores',
  'usuarios',
  'permissoes_tipo',
  'permissoes_contratante',
  'permissoes_empresa',
  'permissoes_usuario',
  'especialidades',
  'projetos',
  'itens_eap',
  'cronograma_financeiro_semanas',
  'cronograma_versions',
  'funcionarios',
  'equipes',
  'equipe_membros',
  'cessoes_pessoal',
  'ordens_servico',
  'rdos',
  'rdo_frentes_servico',
  'rdo_items',
  'rdo_photos',
  'medicoes',
  'itens_medicao_detalhe',
  'dispositivos_mobile',
  'convites',
  'competencias_catalogo',
  'funcionario_treinamentos',
  'avaliacoes_desempenho',
  'avaliacao_itens',
  'ref_cargos_salarios',
  'ref_matriz_encargos',
  'sistema_eventos_catalogo',
  'tenant_bdi_configuracao',
  'tenant_cargos_salarios',
  'validacoes_desenvolvedor',
  'audit_log',
  'system_error_log'
];

async function wipeTable(tableName) {
  process.stdout.write(`Limpando tabela: ${tableName}... `);
  
  // No Supabase, para deletar todas as linhas via API REST, é preciso um filtro. 
  // 'id' não ser nulo cobre 99% das tabelas. Para as que não têm 'id', isso pode falhar.
  const { error } = await prodSupabase
    .from(tableName)
    .delete()
    .not('id', 'is', null); 
    
  if (error) {
    if (error.code === 'PGRST100') {
      // PGRST100: "could not find the 'id' column". Tentando outra coluna comum ou sem filtro (não suportado).
      console.log(`[Pulo - Sem coluna ID ou Vazia]`);
      return;
    }
    console.error(`\n❌ Erro ao limpar ${tableName}:`, error.message);
    // Ignorar falha no wipe e continuar
  } else {
    console.log('✅ OK');
  }
}

async function syncTable(tableName) {
  console.log(`\n--- Sincronizando tabela: ${tableName} ---`);
  
  // 1. Buscar do Local
  const { data: localData, error: localError } = await localSupabase
    .from(tableName)
    .select('*');

  if (localError) {
    // Se a tabela não existir, ignora
    if (localError.code === '42P01') {
      console.log(`⚠️ Tabela ${tableName} não existe localmente. Ignorando.`);
      return;
    }
    console.error(`❌ Erro ao ler ${tableName} do banco local:`, localError.message);
    return;
  }

  console.log(`Encontrados ${localData.length} registros no banco local.`);

  if (localData.length === 0) return;

  // Lote de Upsert (Supabase tem limite de tamanho por requisição, dividimos em chunks de 500)
  const chunkSize = 500;
  let successCount = 0;
  
  for (let i = 0; i < localData.length; i += chunkSize) {
    const chunk = localData.slice(i, i + chunkSize);
    
    const { error: prodError } = await prodSupabase
      .from(tableName)
      .upsert(chunk); // Upsert insere ou atualiza, baseado na PK

    if (prodError) {
      console.error(`❌ Erro ao inserir lote em ${tableName}:`, prodError.message);
    } else {
      successCount += chunk.length;
    }
  }

  console.log(`✅ ${successCount} registros migrados para a produção.`);
}

async function main() {
  console.log('Fase 1: Limpeza (Wipe) do banco de produção (de baixo para cima para evitar FK error)');
  const reverseTables = [...tables].reverse();
  for (const table of reverseTables) {
    await wipeTable(table);
  }

  console.log('\n=========================================\n');
  
  console.log('Fase 2: Migração de dados (de cima para baixo)');
  for (const table of tables) {
    await syncTable(table);
  }
  
  console.log('\n🎉 Sincronização concluída com sucesso!');
}

main().catch(err => {
  console.error('\n💥 Erro crítico:', err);
});

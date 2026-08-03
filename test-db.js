import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Inserindo empresa_contratante...");
  const { data: cData, error: cErr } = await supabase.from('empresa_contratante').upsert({
    contrato_id: 'CTR-TESTE',
    nome: 'Empresa Teste Contratante LTDA',
    cnpj: '00.000.000/0001-00',
    natureza: 'Publica',
    area: 'Engenharia',
    departamento: 'Obras',
    email: 'teste@teste.com',
    telefone: '11999999999',
    gestorresponsavel: 'João',
    unidadeadministrativa: 'Central'
  }, { onConflict: "contrato_id" }).select();
  
  if (cErr) console.error("Erro Contratante:", cErr);
  else console.log("Contratante OK:", cData);

  console.log("Inserindo empresas_fornecedores...");
  const { data: fData, error: fErr } = await supabase.from('empresas_fornecedores').upsert({
    id: 'FORN-TESTE',
    contrato_id: 'CTR-TESTE',
    nome: 'Fornecedor Teste SA',
    cnpj_cpf: '11.111.111/0001-11',
    tipo: 'FORNECEDOR'
  }, { onConflict: "id, contrato_id" }).select();
  
  if (fErr) console.error("Erro Fornecedor:", fErr);
  else console.log("Fornecedor OK:", fData);
}
run();

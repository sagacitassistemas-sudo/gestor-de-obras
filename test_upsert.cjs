const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Mock the environment based on typical local setup
require('dotenv').config({ path: '/mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/.env' });

const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const mockData = [
    {
      contrato_id: 'fake-contrato',
      orgao: 'IOPES',
      mes_ano_ref: '02/2020',
      categoria: 'Mão-de-obra',
      codigo: '99999',
      descricao: 'Teste Ajudante',
      unidade: 'H',
      preco: 10.50
    }
  ];

  const { data, error } = await client
    .from('ref_bases_insumos')
    .upsert(mockData, {
       onConflict: 'contrato_id, orgao, mes_ano_ref, codigo'
    });
    
  console.log("Error:", error);
  console.log("Data:", data);
}

run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL?.replace(/^["']|["']$/g, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^["']|["']$/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProjetos() {
  const { data, error } = await supabase.from('projetos').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("LAST 5 PROJETOS:");
  console.log(data);
}

checkProjetos();

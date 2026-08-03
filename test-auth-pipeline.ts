import handler from './server';
import http from 'http';
import fetch from 'node-fetch';

async function runPipeline() {
  console.log("🚀 Iniciando Pipeline Integrada de Validação de Agentes e Segurança...");
  
  const server = http.createServer(async (req, res) => {
    await handler(req, res);
  });

  const PORT = 9877;
  
  server.listen(PORT, async () => {
    console.log(`[Pipeline Server] Servidor ouvindo na porta ${PORT}...`);
    try {
      // 1. Testar auto-registro de e-mail não cadastrado como VISITANTE
      console.log("\n[Passo 1] Testando auto-registro de e-mail não cadastrado como VISITANTE...");
      const res1 = await fetch(`http://localhost:${PORT}/api/auth/oauth-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", email: "unauthorized.user@test.com", displayName: "Nao Autorizado" })
      });
      console.log(`Status Recebido: ${res1.status}`);
      const data1 = await res1.json();
      if (res1.ok && data1.session && data1.session.customClaims.perfil === "VISITANTE") {
        console.log("✅ Visitor Access: Login não-cadastrado foi corretamente permitido e registrado como VISITANTE!");
      } else {
        console.error(`❌ Visitor Access Falhou! Esperado 200 com perfil VISITANTE, recebido ${res1.status} e perfil ${data1?.session?.customClaims?.perfil}`);
        process.exit(1);
      }

      // 2. Testar login do Administrador Principal
      console.log("\n[Passo 2] Testando login do Administrador Principal...");
      const res2 = await fetch(`http://localhost:${PORT}/api/auth/oauth-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", email: "sagacitas.sistemas@gmail.com", displayName: "Sagacitas Admin" })
      });
      console.log(`Status Recebido: ${res2.status}`);
      const data2 = await res2.json();
      
      if (res2.ok && data2.session && data2.session.customClaims.perfil === "ADMIN") {
        console.log("✅ Admin Authentication: Login realizado com sucesso e perfil ADMIN atribuído!");
      } else {
        console.error("❌ Admin Auth Falhou!");
        process.exit(1);
      }

      // 3. Testar RLS no endpoint POST /api/empresas com Supabase JWT
      console.log("\n[Passo 3] Testando autorização Row-Level Security (RLS) no Supabase...");
      const idToken = data2.session.idToken;
      const res3 = await fetch(`http://localhost:${PORT}/api/empresas`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${idToken}` 
        },
        body: JSON.stringify({
          id: "emp-pipeline-test",
          nome: "Fornecedor Pipeline Teste LTDA",
          cnpj_cpf: "99888777000166",
          tipo: "FORNECEDOR"
        })
      });
      console.log(`Status POST /api/empresas: ${res3.status}`);
      const data3 = await res3.json();
      
      if (res3.ok && data3.success) {
        console.log("✅ RLS Enforcement: Mutação no banco Supabase efetuada com sucesso!");
        console.log("Resultado:", data3.message);
      } else {
        console.error("❌ RLS Mutation Falhou:", data3);
        process.exit(1);
      }

      console.log("\n🎉 PIPELINE CONCLUÍDA COM SUCESSO! Todas as verificações de agentes e segurança passaram.");
      process.exit(0);
    } catch(err: any) {
      console.error("❌ Erro de Execução na Pipeline:", err.message);
      process.exit(1);
    }
  });
}

runPipeline();


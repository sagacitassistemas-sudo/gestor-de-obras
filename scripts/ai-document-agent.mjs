import { GoogleGenAI } from '@google/genai';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Ensure API Key exists
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Erro: GEMINI_API_KEY não encontrada no .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.5-pro';

const dateStr = new Date().toISOString().split('T')[0];
const historyDir = path.join(process.cwd(), '.ai', 'history');
const errorsDir = path.join(process.cwd(), '.ai', 'errors');
const versionFile = path.join(process.cwd(), 'VERSION.md');
const readmeFile = path.join(historyDir, 'README.md');

async function runQualityGate() {
  console.log("🛠️  Iniciando Quality Gate (Testes e Tipagem)...");
  let output = "";
  let passed = true;

  try {
    console.log("   - Executando tsc --noEmit...");
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
  } catch (err) {
    passed = false;
    output += `\n[TSC ERROR]\n${err.stdout ? err.stdout.toString() : err.message}`;
  }

  try {
    console.log("   - Executando testes...");
    execSync('npm run test -- --run', { stdio: 'pipe' });
  } catch (err) {
    passed = false;
    output += `\n[TEST ERROR]\n${err.stdout ? err.stdout.toString() : err.message}`;
  }

  return { passed, output };
}

function getGitContext() {
  console.log("🔍 Extraindo contexto do Git...");
  let diff = "";
  try {
    // 1. Tentar diff de arquivos staged
    diff = execSync('git diff --cached', { encoding: 'utf-8' });
    
    // 2. Se vazio, pegar alterações unstaged
    if (!diff.trim()) {
      diff = execSync('git diff HEAD', { encoding: 'utf-8' });
    }
    
    // 3. Se ainda vazio, pegar o último commit
    if (!diff.trim()) {
      diff = execSync('git log -1 -p', { encoding: 'utf-8' });
    }
  } catch (e) {
    console.warn("⚠️  Aviso: Falha ao obter git diff", e.message);
  }
  return diff.substring(0, 100000); // Limit size
}

function getCurrentVersionState() {
  let versionContent = "";
  try {
     versionContent = fs.readFileSync(versionFile, 'utf-8').substring(0, 2000); // Read top of VERSION.md
  } catch(e) {}
  return versionContent;
}

async function analyzeWithGemini(diffContext, testErrors, versionState) {
  console.log("🧠 Acionando Agente Gemini...");
  
  const systemPrompt = `Você é um Agente Documentador Autônomo para o projeto "Gestor de Obras".
Sua missão é fechar o "Loop de Encerramento" analisando as alterações recentes de código e gerando os artefatos de documentação necessários. 
Considere sempre os guard-rails arquiteturais localizados em .ai/guard-rails/ ao julgar o impacto das alterações.

Regras de Saída: Você deve responder estritamente com um JSON válido contendo:
{
  "type": "success" | "error",
  "filename": "YYYY-MM-DD_nome_descritivo.md",
  "content": "Conteúdo Markdown do arquivo que será salvo (Walkthrough ou Post-Mortem)",
  "versionUpdate": {
    "bumpType": "patch" | "minor",
    "versionChangelog": "Nova entrada formatada em markdown para adicionar no topo do VERSION.md (Ex: ## Versão 1.5.0 (YYYY-MM-DD) - Titulo\\n- Detalhes)"
  },
  "readmeUpdate": {
    "rowEntry": "Uma linha de tabela em markdown formatada para adicionar ao .ai/history/README.md (ex: | **YYYY-MM-DD** | [Tópico](link.md) | \`Domínio\` | Resumo |)"
  }
}

Se a variável "type" for "error" (porque testes falharam), os campos "versionUpdate" e "readmeUpdate" devem ser null, e o "filename" deve usar a sintaxe YYYY-MM-DD_resumo_do_erro.md para a pasta de errors/.`;

  const prompt = `Contexto Git (O que foi alterado):
${diffContext}

Erros de Teste (vazio se tudo passou):
${testErrors}

Top do VERSION.md atual:
${versionState}

A data de hoje é: ${dateStr}

Determine se a atualização é de sucesso (historico) ou erro (post-mortem). Gere o JSON correspondente em formato RAW. Não inclua blocos markdown de json, APENAS O RAW JSON!`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
  });

  return JSON.parse(response.text());
}

async function main() {
  const gate = await runQualityGate();
  const gitContext = getGitContext();
  const versionState = getCurrentVersionState();

  if (!gitContext.trim() && gate.passed) {
    console.log("ℹ️  Nenhuma alteração detectada e testes passaram. Agente abortado.");
    process.exit(0);
  }

  const result = await analyzeWithGemini(gitContext, gate.passed ? "" : gate.output, versionState);

  if (result.type === 'error' || !gate.passed) {
    console.log("❌ Quality Gate Falhou ou Erro Analisado. Gerando Post-Mortem...");
    const errorPath = path.join(errorsDir, result.filename);
    fs.writeFileSync(errorPath, result.content);
    console.log(`📄 Post-mortem salvo em: ${errorPath}`);
    process.exit(1);
  }

  console.log("✅ Quality Gate Aprovado. Gerando Histórico...");
  const histPath = path.join(historyDir, result.filename);
  fs.writeFileSync(histPath, result.content);
  console.log(`📄 Walkthrough salvo em: ${histPath}`);

  if (result.versionUpdate) {
    console.log("🔄 Atualizando VERSION.md...");
    let vContent = fs.readFileSync(versionFile, 'utf-8');
    vContent = vContent.replace('# Histórico de Versões\n\n', `# Histórico de Versões\n\n${result.versionUpdate.versionChangelog}\n\n---\n\n`);
    fs.writeFileSync(versionFile, vContent);
  }

  if (result.readmeUpdate) {
    console.log("🔄 Atualizando .ai/history/README.md...");
    let rContent = fs.readFileSync(readmeFile, 'utf-8');
    rContent += `\n${result.readmeUpdate.rowEntry}`;
    fs.writeFileSync(readmeFile, rContent);
  }

  console.log("🚀 Loop de Encerramento finalizado com sucesso!");
}

main().catch(err => {
  console.error("Falha na execução do agente:", err);
  process.exit(1);
});

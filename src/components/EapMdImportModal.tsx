import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { SimulationResult, ParsedEapItem } from '../services/eapImporter.service';

interface EapMdImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projetoId: string;
  projetoNome: string;
  authSession?: any;
  onSuccess: () => void;
}

export const EapMdImportModal: React.FC<EapMdImportModalProps> = ({
  isOpen,
  onClose,
  projetoId,
  projetoNome,
  authSession,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [mdContent, setMdContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setMdContent(text || '');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    const sample = `| Código EAP | Descrição / Serviço | Unidade | Preço Unit. | Qtd Contratada | Categoria |
|---|---|---|---|---|---|
| 1 | SERVIÇOS PRELIMINARES | | | | Infraestrutura |
| 1.1 | Canteiro de Obras | | | | Infraestrutura |
| 1.1.1 | Barracão de Madeira 3x4m | m² | 180.00 | 12 | Canteiro |
| 1.1.2 | Placa da Obra em Aço Galvanizado | un | 1500.00 | 1 | Sinalização |
| 1.1.3 | Ligação Provisória de Água e Esgoto | cj | 2400.00 | 1 | Instalações |
| 1.2 | Serviços de Limpeza e Locação | | | | Preparação |
| 1.2.1 | Limpeza de Terreno com Trator | m² | 4.50 | 1500 | Terraplenagem |
| 1.2.2 | Locação Global da Obra | m² | 8.20 | 450 | Agrimensura |
| 2 | ESTRUTURAS E FUNDAÇÕES | | | | Estrutura |
| 2.1 | Movimentação de Terra | | | | Escavação |
| 2.1.1 | Escavação Mecanizada para Sapata | m³ | 45.00 | 120 | Solo |
`;
    setMdContent(sample);
    setFileName('exemplo_eap_obras.md');
  };

  const handleAnalyze = async () => {
    if (!mdContent.trim()) {
      setErrorMessage('Por favor, selecione um arquivo .md ou cole a estrutura no campo.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;

      const res = await fetch('/api/eap/import/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          projeto_id: projetoId,
          md_content: mdContent
        })
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch (err) {
        if (res.status === 404) {
          setErrorMessage('Erro 404: Endpoint da API não encontrado. Por favor, reinicie o servidor dev.');
        } else {
          setErrorMessage(`Servidor retornou resposta HTTP ${res.status} não formatada em JSON.`);
        }
        return;
      }

      if (res.ok && json.success) {
        setSimulation(json.simulation);
        // Advance through steps 2, 3 and reach step 4 (Validation & Preview)
        setCurrentStep(4);
      } else {
        setErrorMessage(json.error || 'Falha ao analisar o arquivo Markdown.');
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage('Erro de conexão ao analisar a EAP: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!simulation || !simulation.items || simulation.items.length === 0) return;

    setLoading(true);
    setErrorMessage(null);
    setCurrentStep(5);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;

      const res = await fetch('/api/eap/import/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          projeto_id: projetoId,
          items: simulation.items
        })
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch (err) {
        setErrorMessage(`Servidor retornou resposta HTTP ${res.status} inesperada.`);
        return;
      }

      if (res.ok && json.success) {
        setImportResult({ count: json.importedCount });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        const mainErr = json.error || 'Erro ao realizar a importação no banco de dados.';
        let detailsText = '';
        if (json.details && Array.isArray(json.details) && json.details.length > 0) {
          detailsText = json.details.map((d: any) => `${d.itemCode ? `[Item ${d.itemCode}] ` : ''}${d.message}`).join('; ');
        }
        setErrorMessage(detailsText ? `${mainErr}: ${detailsText}` : mainErr);
        setCurrentStep(4);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage('Erro inesperado ao persistir os dados: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-[#c0c7d6]">
        
        {/* HEADER MODAL */}
        <div className="px-6 py-4 bg-[#f7f9fb] border-b border-[#e1e2e8] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#005daa]/10 text-[#005daa] rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div>
              <h2 className="text-title-lg font-bold text-[#191c1e]">Importador de Etapas EAP (.md)</h2>
              <p className="text-body-xs text-[#707785]">Projeto: <strong className="text-[#005daa]">{projetoNome}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#707785] hover:bg-[#e1e2e8] rounded-full transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* STEPPER BAR (5 ETAPAS) */}
        <div className="px-6 py-3 bg-[#eff6ff] border-b border-[#d4e3ff] flex items-center justify-between overflow-x-auto text-[11px] font-label-bold">
          <div className={`flex items-center gap-1.5 ${currentStep >= 1 ? 'text-[#005daa] font-bold' : 'text-[#707785]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 1 ? 'bg-[#005daa] text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
            Leitura (.md)
          </div>
          <span className="text-[#c0c7d6]">➔</span>
          <div className={`flex items-center gap-1.5 ${currentStep >= 2 ? 'text-[#005daa] font-bold' : 'text-[#707785]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 2 ? 'bg-[#005daa] text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
            Ajustes de BD
          </div>
          <span className="text-[#c0c7d6]">➔</span>
          <div className={`flex items-center gap-1.5 ${currentStep >= 3 ? 'text-[#005daa] font-bold' : 'text-[#707785]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 3 ? 'bg-[#005daa] text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
            Testes
          </div>
          <span className="text-[#c0c7d6]">➔</span>
          <div className={`flex items-center gap-1.5 ${currentStep >= 4 ? 'text-[#005daa] font-bold' : 'text-[#707785]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 4 ? 'bg-[#005daa] text-white' : 'bg-slate-200 text-slate-600'}`}>4</span>
            Validar
          </div>
          <span className="text-[#c0c7d6]">➔</span>
          <div className={`flex items-center gap-1.5 ${currentStep === 5 ? 'text-[#10b981] font-bold' : 'text-[#707785]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 5 ? 'bg-[#10b981] text-white' : 'bg-slate-200 text-slate-600'}`}>5</span>
            Importar
          </div>
        </div>

        {/* CONTÉUDO DO CORPO */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px] text-red-600 mt-0.5">error</span>
              <div>
                <strong className="block font-bold">Erro no Processamento:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* PASSO 1: UPLOAD / LEITURA */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-[#f8fafc] border border-slate-200 rounded-xl">
                <p className="text-body-sm text-[#404753] mb-3">
                  Selecione um arquivo Markdown (<code>.md</code>) contendo a tabela ou árvore da EAP, ou cole o conteúdo diretamente.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="px-4 py-2 bg-white border border-[#c0c7d6] text-[#005daa] font-label-bold rounded-lg hover:bg-[#f2f4f6] transition-colors cursor-pointer flex items-center gap-2 shadow-xs">
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    Carregar Arquivo .MD
                    <input type="file" accept=".md,.markdown,.txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button onClick={handleLoadSample} className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-700 font-label-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">difference</span>
                    Carregar Exemplo de Teste
                  </button>
                  {fileName && (
                    <span className="text-body-xs text-[#10b981] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      {fileName}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Conteúdo Markdown (.md)</label>
                <textarea
                  rows={10}
                  value={mdContent}
                  onChange={(e) => setMdContent(e.target.value)}
                  placeholder="| Código EAP | Descrição | Unidade | Preço Unit. | Qtd |\n|---|---|---|---|---|\n| 1 | SERVIÇOS PRELIMINARES | | | |"
                  className="w-full p-3 font-mono text-xs bg-slate-950 text-slate-100 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005daa]"
                />
              </div>
            </div>
          )}

          {/* PASSO 4: VALIDAÇÃO E MODELO INTERPRETADO */}
          {currentStep >= 4 && simulation && (
            <div className="space-y-5 animate-in fade-in duration-300">
              
              {/* CARDS DE MÉTRICAS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Total de Itens</span>
                  <p className="text-headline-sm font-bold text-slate-900 font-metric-mono">{simulation.metrics.totalItems}</p>
                </div>
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-[10px] text-blue-700 font-bold uppercase">Sintéticos (Agrupadores)</span>
                  <p className="text-headline-sm font-bold text-blue-800 font-metric-mono">{simulation.metrics.syntheticCount}</p>
                </div>
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase">Analíticos (Serviços)</span>
                  <p className="text-headline-sm font-bold text-emerald-800 font-metric-mono">{simulation.metrics.analyticCount}</p>
                </div>
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[10px] text-amber-800 font-bold uppercase">Valor Total Calculado</span>
                  <p className="text-headline-sm font-bold text-amber-900 font-metric-mono">{formatCurrency(simulation.metrics.totalContractValue)}</p>
                </div>
              </div>

              {/* ANÁLISE DE ESQUEMA DE BANCO DE DADOS (ETAPA 2 & 3) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <h4 className="font-bold text-[#005daa] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">schema</span>
                  Análise do Esquema do BD em Memória (Etapas 2 e 3)
                </h4>
                <div className="flex flex-wrap gap-4 text-slate-700">
                  <div>
                    <span className="text-slate-500">Colunas Mapeadas ({simulation.schemaAnalysis.mappedColumns.length}): </span>
                    <span className="font-mono font-bold text-slate-800">{simulation.schemaAnalysis.mappedColumns.join(', ') || 'Todas padrões'}</span>
                  </div>
                  {simulation.schemaAnalysis.newCustomColumns.length > 0 && (
                    <div>
                      <span className="text-amber-600 font-bold">Novos Campos Detectados: </span>
                      <span className="font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{simulation.schemaAnalysis.newCustomColumns.join(', ')}</span>
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Ação prevista: <strong className="text-emerald-700">{simulation.metrics.newItemsCount} Novos registros</strong> e <strong className="text-blue-700">{simulation.metrics.updateItemsCount} Atualizações</strong>.
                </div>
              </div>

              {/* AVISOS DE VALIDAÇÃO */}
              {simulation.issues.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Avisos e Observações ({simulation.issues.length}):</h4>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {simulation.issues.map((iss, idx) => (
                      <div key={idx} className={`p-2 rounded text-xs flex items-center gap-2 ${iss.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                        <span className="material-symbols-outlined text-[14px]">{iss.type === 'error' ? 'cancel' : 'warning'}</span>
                        <span>{iss.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TABELA DO MODELO INTERPRETADO */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Modelo Interpretado para Aprovação (Etapa 4):</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 sticky top-0 text-slate-600 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-2 border-b">Item</th>
                        <th className="p-2 border-b">Descrição</th>
                        <th className="p-2 border-b text-center">Un.</th>
                        <th className="p-2 border-b text-right">Preço</th>
                        <th className="p-2 border-b text-right">Qtd</th>
                        <th className="p-2 border-b text-right">Total (R$)</th>
                        <th className="p-2 border-b text-center">Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulation.items.map((row: ParsedEapItem, idx: number) => (
                        <tr key={`${row.eap_codigo}-${idx}`} className={`border-b border-slate-100 ${!row.e_analitico ? 'bg-slate-50 font-bold' : 'hover:bg-slate-50'}`}>
                          <td className="p-2 font-mono">{row.eap_codigo}</td>
                          <td className="p-2">{row.descricao_servico}</td>
                          <td className="p-2 text-center text-slate-500">{row.unidade_medida || '-'}</td>
                          <td className="p-2 text-right font-mono">{row.e_analitico ? formatCurrency(row.preco_unitario) : '-'}</td>
                          <td className="p-2 text-right font-mono">{row.e_analitico ? row.quantidade_contratada : '-'}</td>
                          <td className="p-2 text-right font-mono text-[#005daa]">{formatCurrency(row.valor_total_contratado)}</td>
                          <td className="p-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${!row.e_analitico ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {!row.e_analitico ? 'Sintético' : 'Analítico'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 5: IMPORTAÇÃO E SUCESSO */}
          {currentStep === 5 && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              {loading ? (
                <>
                  <div className="w-12 h-12 border-4 border-[#005daa] border-t-transparent rounded-full animate-spin"></div>
                  <h3 className="text-title-lg font-bold text-[#191c1e]">Realizando Importação (Etapa 5)...</h3>
                  <p className="text-body-sm text-[#707785]">Gravando as etapas da EAP no banco de dados.</p>
                </>
              ) : importResult ? (
                <>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-in zoom-in-50 duration-300">
                    <span className="material-symbols-outlined text-[36px]">check_circle</span>
                  </div>
                  <h3 className="text-headline-sm font-bold text-emerald-700">Importação Concluída com Sucesso!</h3>
                  <p className="text-body-md text-slate-600">
                    <strong>{importResult.count}</strong> etapas foram gravadas com sucesso no projeto <strong>{projetoNome}</strong>.
                  </p>
                </>
              ) : null}
            </div>
          )}

        </div>

        {/* FOOTER DO MODAL */}
        <div className="px-6 py-4 bg-[#f7f9fb] border-t border-[#e1e2e8] flex justify-between items-center">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border border-[#c0c7d6] text-[#404753] font-label-bold rounded-lg hover:bg-[#e2e8f0] transition-colors cursor-pointer">
            Cancelar
          </button>

          <div className="flex gap-3">
            {currentStep === 1 && (
              <button
                onClick={handleAnalyze}
                disabled={loading || !mdContent.trim()}
                className="px-5 py-2.5 bg-[#005daa] text-white font-label-bold rounded-lg hover:bg-[#004a88] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                )}
                Analisar e Simular (Etapas 1 a 4)
              </button>
            )}

            {currentStep === 4 && (
              <>
                <button onClick={() => setCurrentStep(1)} className="px-4 py-2 border border-slate-300 text-slate-700 font-label-bold rounded-lg hover:bg-slate-100">
                  Voltar e Editar .MD
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={loading || !simulation?.valid}
                  className="px-6 py-2.5 bg-emerald-600 text-white font-label-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  Aprovar e Importar (Etapa 5)
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

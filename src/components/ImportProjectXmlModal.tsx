import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { parseMsProjectXml, MspImportResult, readFileAsText } from '../utils/msProjectXmlParser';
import { SimulationResult, ParsedEapItem } from '../services/eapImporter.service';

interface ImportProjectXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  authSession?: any;
  onSuccess: (projetoId: string) => void;
}

export const ImportProjectXmlModal: React.FC<ImportProjectXmlModalProps> = ({
  isOpen,
  onClose,
  authSession,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [file, setFile] = useState<File | null>(null);
  const [xmlResult, setXmlResult] = useState<MspImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Opções de projeto
  const [importMode, setImportMode] = useState<'new' | 'existing'>('new');
  const [projectName, setProjectName] = useState('');
  const [projectStart, setProjectStart] = useState('');
  
  const [existingProjects, setExistingProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setXmlResult(null);
      setProjectName('');
      setProjectStart('');
      setErrorMessage(null);
      setLoading(false);
      setCurrentStep(1);
      setImportMode('new');
      setSelectedProjectId('');
      setSimulation(null);
      setImportResult(null);
      fetchProjects();
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      
      const res = await fetch('/api/projetos', { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (res.ok) {
        const json = await res.json();
        const list = json.projetos || json;
        if (Array.isArray(list)) {
          setExistingProjects(list.sort((a: any, b: any) => a.nome_projeto.localeCompare(b.nome_projeto)));
          return;
        }
      }
      
      // Fallback
      const { data, error } = await supabase.from('projetos').select('id, nome_projeto').order('nome_projeto');
      if (!error && data) {
        setExistingProjects(data);
      }
    } catch (e) {
      console.warn('Erro ao buscar projetos:', e);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setLoading(true);
    setErrorMessage(null);
    setFile(selectedFile);

    try {
      const xmlString = await readFileAsText(selectedFile);
      const result = parseMsProjectXml(xmlString);
      
      setXmlResult(result);
      setProjectName(result.projectName);
      setProjectStart(result.projectStart);
      setCurrentStep(2);
      
      if (result.warnings.length > 0) {
        console.warn('Avisos na importação XML:', result.warnings);
      }
    } catch (err: any) {
      setErrorMessage(`Erro ao ler o arquivo XML: ${err.message}`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!xmlResult) return;
    
    if (importMode === 'new') {
      if (!projectName.trim()) {
        setErrorMessage('O Nome do Projeto é obrigatório.');
        return;
      }
      if (!projectStart) {
        setErrorMessage('A Data de Início é obrigatória.');
        return;
      }
    } else {
      if (!selectedProjectId) {
        setErrorMessage('Selecione um projeto existente.');
        return;
      }
    }

    setLoading(true);
    setErrorMessage(null);
    setCurrentStep(3);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;

      const pId = importMode === 'new' ? 'new' : selectedProjectId;

      // Map EapEngineItem to ParsedEapItem expected by the pipeline
      const parsedItems: ParsedEapItem[] = xmlResult.items.map((item, index) => ({
        eap_codigo: item.eap_codigo,
        eap_pai_codigo: deriveParentCode(item.eap_codigo),
        descricao_servico: item.descricao_servico,
        unidade_medida: item.e_analitico ? 'un' : null,
        preco_unitario: 0,
        quantidade_contratada: 0,
        valor_total_contratado: 0,
        e_analitico: item.e_analitico,
        ordem: index + 1,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        duracao_dias: item.duracao_dias,
        predecessores: item.predecessores,
        percentual_executado_financeiro: item.percentual_executado_financeiro
      }));

      const res = await fetch('/api/eap/import/analyze-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          projeto_id: pId,
          items: parsedItems
        })
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch (err) {
        setErrorMessage(`Servidor retornou resposta HTTP ${res.status} não formatada em JSON.`);
        setCurrentStep(2);
        return;
      }

      if (res.ok && json.success) {
        setSimulation(json.simulation);
        setCurrentStep(4);
      } else {
        setErrorMessage(json.error || 'Falha ao analisar o arquivo XML na pipeline.');
        setCurrentStep(2);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage('Erro de conexão ao analisar: ' + e.message);
      setCurrentStep(2);
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

      let targetProjectId = selectedProjectId;

      // 1. Criar projeto se for novo
      if (importMode === 'new') {
        const resProjeto = await fetch('/api/projetos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            nome_projeto: projectName,
            data_inicio: projectStart,
          })
        });

        if (!resProjeto.ok) {
          const errJson = await resProjeto.json().catch(() => ({}));
          throw new Error(errJson.error || 'Falha ao criar o projeto.');
        }

        const { projeto } = await resProjeto.json();
        if (!projeto || !projeto.id) {
          throw new Error('ID do projeto não retornado pela API.');
        }
        targetProjectId = projeto.id;
      }

      // 2. Executar a importação dos itens via pipeline
      const res = await fetch('/api/eap/import/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          projeto_id: targetProjectId,
          items: simulation.items
        })
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch (err) {
        throw new Error(`Servidor retornou resposta HTTP ${res.status} inesperada.`);
      }

      if (res.ok && json.success) {
        setImportResult({ count: json.importedCount });
        setTimeout(() => {
          onSuccess(targetProjectId);
          onClose();
        }, 2000);
      } else {
        const mainErr = json.error || 'Erro ao realizar a importação no banco de dados.';
        let detailsText = '';
        if (json.details && Array.isArray(json.details) && json.details.length > 0) {
          detailsText = json.details.map((d: any) => `${d.itemCode ? `[Item ${d.itemCode}] ` : ''}${d.message}`).join('; ');
        }
        throw new Error(detailsText ? `${mainErr}: ${detailsText}` : mainErr);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage('Erro ao persistir dados: ' + e.message);
      setCurrentStep(4);
    } finally {
      setLoading(false);
    }
  };

  const deriveParentCode = (codigo: string): string | null => {
    if (!codigo) return null;
    const parts = codigo.trim().split('.');
    if (parts.length <= 1) return null;
    return parts.slice(0, parts.length - 1).join('.');
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
              <span className="material-symbols-outlined text-[24px]">account_tree</span>
            </div>
            <div>
              <h2 className="text-title-lg font-bold text-[#191c1e]">Importar Projeto MS Project (.xml / .mpp)</h2>
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
            Leitura XML
          </div>
          <span className="text-[#c0c7d6]">➔</span>
          <div className={`flex items-center gap-1.5 ${currentStep >= 2 ? 'text-[#005daa] font-bold' : 'text-[#707785]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 2 ? 'bg-[#005daa] text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
            Opções do Projeto
          </div>
          <span className="text-[#c0c7d6]">➔</span>
          <div className={`flex items-center gap-1.5 ${currentStep >= 3 ? 'text-[#005daa] font-bold' : 'text-[#707785]'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep >= 3 ? 'bg-[#005daa] text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
            Análise & Testes
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
                <strong className="block font-bold">Erro:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* PASSO 1: UPLOAD / LEITURA */}
          {currentStep === 1 && (
            <div className="text-center py-6">
              <p className="text-body-md text-[#404753] mb-6">
                Selecione um arquivo .xml ou .mpp exportado do Microsoft Project para importá-lo no sistema usando o Motor de Pipeline.
              </p>
              
              <input 
                type="file" 
                accept=".xml,.mpp" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex flex-col items-center justify-center gap-3 w-full max-w-md mx-auto border-2 border-dashed border-[#c0c7d6] bg-[#f8fafc] hover:bg-[#eff6ff] hover:border-[#005daa] transition-colors rounded-xl py-12 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[48px] text-[#005daa] animate-spin">autorenew</span>
                    <span className="font-bold text-[#005daa]">Lendo arquivo...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[48px] text-[#707785]">upload</span>
                    <span className="font-bold text-[#404753]">Clique para buscar o arquivo (.xml ou .mpp)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* PASSO 2: OPÇÕES DE PROJETO */}
          {currentStep === 2 && xmlResult && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#e8f5e9] border border-[#a5d6a7] p-4 rounded-lg flex items-center gap-4">
                <div className="bg-white p-2 rounded-full text-green-700">
                  <span className="material-symbols-outlined text-[24px]">task_alt</span>
                </div>
                <div>
                  <p className="font-bold text-green-900">Arquivo lido com sucesso!</p>
                  <p className="text-sm text-green-800">
                    Foram encontradas <strong>{xmlResult.items.length}</strong> etapas no cronograma.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4">
                <h3 className="font-label-bold text-slate-800 mb-2">Como deseja importar estes dados?</h3>
                
                <div className="flex flex-col gap-3">
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors bg-white hover:border-[#005daa] has-[:checked]:border-[#005daa] has-[:checked]:ring-1 has-[:checked]:ring-[#005daa]">
                    <input 
                      type="radio" 
                      name="importMode" 
                      value="new"
                      checked={importMode === 'new'}
                      onChange={() => setImportMode('new')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-bold text-[#191c1e]">Criar um Novo Projeto</p>
                      <p className="text-xs text-slate-500">Cria um novo projeto vazio e importa todas as etapas.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors bg-white hover:border-[#005daa] has-[:checked]:border-[#005daa] has-[:checked]:ring-1 has-[:checked]:ring-[#005daa]">
                    <input 
                      type="radio" 
                      name="importMode" 
                      value="existing"
                      checked={importMode === 'existing'}
                      onChange={() => setImportMode('existing')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-bold text-[#191c1e]">Integrar a um Projeto Existente</p>
                      <p className="text-xs text-slate-500">Atualiza etapas existentes (pelo código EAP) e adiciona as novas etapas.</p>
                    </div>
                  </label>
                </div>
              </div>

              {importMode === 'new' ? (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                      Nome do Novo Projeto <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                      Data de Início do Projeto <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={projectStart}
                      onChange={e => setProjectStart(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                      Selecione o Projeto <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                    >
                      <option value="">-- Selecione --</option>
                      {existingProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.nome_projeto}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              {xmlResult.warnings.length > 0 && (
                <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-4 max-h-32 overflow-y-auto">
                  <p className="text-amber-800 font-bold text-xs uppercase mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    Avisos da Importação XML ({xmlResult.warnings.length})
                  </p>
                  <ul className="list-disc pl-4 text-xs text-amber-700 space-y-1">
                    {xmlResult.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* PASSO 4: VALIDAÇÃO */}
          {currentStep >= 4 && simulation && (
            <div className="space-y-5 animate-in fade-in duration-300">
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
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="text-[10px] text-indigo-700 font-bold uppercase">Novos / Atualizações</span>
                  <p className="text-headline-sm font-bold text-indigo-900 font-metric-mono">{simulation.metrics.newItemsCount} / {simulation.metrics.updateItemsCount}</p>
                </div>
              </div>

              {simulation.issues.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Avisos de Pipeline ({simulation.issues.length}):</h4>
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

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Modelo Interpretado para Aprovação (Etapa 4):</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 sticky top-0 text-slate-600 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-2 border-b">EAP</th>
                        <th className="p-2 border-b">Descrição</th>
                        <th className="p-2 border-b text-center">Ação</th>
                        <th className="p-2 border-b text-center">Tipo</th>
                        <th className="p-2 border-b">Duração</th>
                        <th className="p-2 border-b">Datas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulation.items.map((row: ParsedEapItem, idx: number) => (
                        <tr key={`${row.eap_codigo}-${idx}`} className={`border-b border-slate-100 ${!row.e_analitico ? 'bg-slate-50 font-bold' : 'hover:bg-slate-50'}`}>
                          <td className="p-2 font-mono">{row.eap_codigo}</td>
                          <td className="p-2">{row.descricao_servico}</td>
                          <td className="p-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${row.action === 'NEW' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                              {row.action === 'NEW' ? 'Novo' : 'Atualizar'}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${!row.e_analitico ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {!row.e_analitico ? 'Sintético' : 'Analítico'}
                            </span>
                          </td>
                          <td className="p-2 text-slate-600">{row.duracao_dias || 0}d</td>
                          <td className="p-2 text-[10px] text-slate-500 whitespace-nowrap">
                            {row.data_inicio} até {row.data_fim}
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
                    <strong>{importResult.count}</strong> etapas foram gravadas com sucesso no projeto.
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
            {currentStep === 2 && xmlResult && (
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="px-5 py-2.5 bg-[#005daa] text-white font-label-bold rounded-lg hover:bg-[#004a88] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                )}
                Analisar e Simular (Etapas 3 e 4)
              </button>
            )}

            {currentStep === 4 && (
              <>
                <button onClick={() => setCurrentStep(2)} className="px-4 py-2 border border-slate-300 text-slate-700 font-label-bold rounded-lg hover:bg-slate-100">
                  Voltar
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={loading || !simulation?.valid}
                  className="px-6 py-2.5 bg-emerald-600 text-white font-label-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
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

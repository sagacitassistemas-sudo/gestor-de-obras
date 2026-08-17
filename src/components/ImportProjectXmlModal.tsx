import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { parseMsProjectXml, MspImportResult, readFileAsText } from '../utils/msProjectXmlParser';

interface ImportProjectXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  authSession?: any;
  onSuccess: (newProjetoId: string) => void;
}

export const ImportProjectXmlModal: React.FC<ImportProjectXmlModalProps> = ({
  isOpen,
  onClose,
  authSession,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [xmlResult, setXmlResult] = useState<MspImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulário do novo projeto
  const [projectName, setProjectName] = useState('');
  const [projectStart, setProjectStart] = useState('');

  // Resetar ao fechar ou abrir
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setXmlResult(null);
      setProjectName('');
      setProjectStart('');
      setErrorMsg(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setLoading(true);
    setErrorMsg(null);
    setFile(selectedFile);

    try {
      const xmlString = await readFileAsText(selectedFile);
      const result = parseMsProjectXml(xmlString);
      
      setXmlResult(result);
      setProjectName(result.projectName);
      setProjectStart(result.projectStart);
      
      if (result.warnings.length > 0) {
        console.warn('Avisos na importação XML:', result.warnings);
      }
    } catch (err: any) {
      setErrorMsg(`Erro ao ler o arquivo XML: ${err.message}`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!xmlResult) return;
    if (!projectName.trim()) {
      setErrorMsg('O Nome do Projeto é obrigatório.');
      return;
    }
    if (!projectStart) {
      setErrorMsg('A Data de Início é obrigatória.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || authSession?.idToken;

      // 1. Criar o Projeto
      const resProjeto = await fetch('/api/projetos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

      const newProjetoId = projeto.id;

      // 2. Inserir os itens EAP
      let errors = 0;
      for (const item of xmlResult.items) {
        const payload = {
          projeto_id: newProjetoId,
          eap_codigo: item.eap_codigo,
          descricao_servico: item.descricao_servico,
          data_inicio: item.data_inicio,
          data_execucao: item.data_inicio,
          duracao_dias: item.duracao_dias,
          data_fim: item.data_fim,
          e_analitico: item.e_analitico,
          unidade_medida: item.e_analitico ? 'ud' : null,
          predecessores: item.predecessores,
          percentual_executado_financeiro: item.percentual_executado_financeiro,
        };

        const resItem = await fetch('/api/itens-eap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!resItem.ok) {
          console.warn(`[ImportProjectXmlModal] Falha ao salvar etapa ${item.eap_codigo}`);
          
          // Fallback via Supabase
          const { error: sbErr } = await supabase.from('itens_eap').insert([payload]);
          if (sbErr) errors++;
        }
      }

      if (errors > 0) {
        console.warn(`Houve erro ao inserir ${errors} tarefas.`);
      }

      alert(`Projeto "${projectName}" criado com sucesso e ${xmlResult.items.length - errors} etapas importadas!`);
      onSuccess(newProjetoId);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro durante a criação do projeto e importação das etapas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#c0c7d6]">
        
        <div className="p-5 border-b border-[#e1e2e8] bg-[#f8fafc] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#005daa] text-[24px]">upload_file</span>
            <h2 className="text-title-lg font-display font-bold text-[#191c1e]">
              Importar MS Project (.xml / .mpp)
            </h2>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-200 p-1.5 rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        
        <div className="p-6">
          {errorMsg && (
            <div className="mb-6 bg-red-50 text-red-700 border border-red-200 p-4 rounded-lg flex items-start gap-3 text-sm">
              <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
              <div>
                <p className="font-bold">Erro na importação</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {!xmlResult ? (
            <div className="text-center">
              <p className="text-body-md text-[#404753] mb-6">
                Selecione um arquivo .xml ou .mpp exportado do Microsoft Project. 
                Isso criará um <strong>Novo Projeto</strong> no sistema com todas as tarefas e dependências contidas no arquivo.
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
                className="flex flex-col items-center justify-center gap-3 w-full border-2 border-dashed border-[#c0c7d6] bg-[#f8fafc] hover:bg-[#eff6ff] hover:border-[#005daa] transition-colors rounded-xl py-12 cursor-pointer"
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
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
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

              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Nome do Novo Projeto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                />
                <p className="text-xs text-[#707785] mt-1.5">Sugerido a partir do arquivo XML importado.</p>
              </div>

              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Data de Início do Projeto <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={projectStart}
                  onChange={e => setProjectStart(e.target.value)}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                />
              </div>

              {xmlResult.warnings.length > 0 && (
                <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-4 max-h-32 overflow-y-auto">
                  <p className="text-amber-800 font-bold text-xs uppercase mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    Avisos da Importação ({xmlResult.warnings.length})
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
        </div>

        {xmlResult && (
          <div className="p-4 bg-[#f2f4f6] flex justify-end gap-3 border-t border-[#e1e2e8]">
            <button 
              onClick={() => setXmlResult(null)} 
              disabled={loading}
              className="px-5 py-2.5 border border-[#c0c7d6] text-[#404753] font-label-bold hover:bg-[#e2e8f0] rounded-md transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirmImport} 
              disabled={loading}
              className="px-5 py-2.5 bg-[#005daa] text-white font-label-bold rounded-md hover:bg-[#004a88] transition-colors shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">autorenew</span>
                  Criando Projeto...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Criar Projeto e Importar
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

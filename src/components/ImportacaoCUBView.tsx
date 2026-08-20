import React, { useState, useEffect } from 'react';
import { AuthSession } from '../types';

interface ImportacaoCUBViewProps {
  authSession?: AuthSession | null;
}

interface CUBBaseInfo {
  uf: string;
  sinduscon_nome: string;
  mes_referencia: string;
  atualizado_em: string;
  status: 'ATUALIZADO' | 'DESATUALIZADO';
  projetos: number;
}

export const ImportacaoCUBView: React.FC<ImportacaoCUBViewProps> = ({ authSession }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [viewingBase, setViewingBase] = useState<any>(null);
  const [bases, setBases] = useState<CUBBaseInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Scraper State
  const [selectedUf, setSelectedUf] = useState('ES');
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authSession?.idToken) return;
    fetchBases();
  }, [authSession?.idToken]);

  const fetchBases = async () => {
    try {
      const response = await fetch('/api/cub/bases', {
        headers: {
          'Authorization': `Bearer ${authSession?.idToken}`
        }
      });
      if (response.ok) {
        const resData = await response.json();
        setBases(resData.bases || []);
      }
    } catch (error) {
      console.error("Erro ao buscar bases CUB:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    if (selectedUf !== 'ES') {
      alert("Apenas Sinduscon-ES possui rotina automática no momento.");
      return;
    }
    
    setIsImporting(true);
    setScrapedData(null);
    
    try {
      const response = await fetch('/api/cub/scrape', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify({ uf: selectedUf })
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        setScrapedData(resData.data);
      } else {
        alert(`Erro na raspagem: ${resData.message}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erro: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!authSession?.idToken) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uf', selectedUf);

      const res = await fetch('/api/cub/import-pdf', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession.idToken}`
        },
        body: formData
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setScrapedData(resData.data);
      } else {
        alert(`Erro na importação do PDF: ${resData.message}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erro: ${err.message}`);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!scrapedData) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/cub/save', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify({ 
          uf: scrapedData.uf,
          sinduscon: scrapedData.sinduscon,
          mesReferencia: scrapedData.mesReferencia,
          valores: scrapedData.valores
        })
      });
      
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.message || 'Erro ao salvar CUB');
      
      alert("Base CUB salva com sucesso!");
      setShowImportModal(false);
      setScrapedData(null);
      fetchBases();
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e1e2e8] p-6 shadow-sm z-10 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#005daa]">download_for_offline</span>
            Importação CUB (Custo Unitário Básico)
          </h2>
          <p className="text-sm text-[#707785] mt-1">
            Gerencie as bases de referência de custos de construção (Sinduscon) utilizadas nos orçamentos base.
          </p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#005daa] text-white rounded-lg font-bold shadow-sm hover:bg-[#004a88] transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">upload_file</span>
          Importar Nova Base
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        
        {/* Painel de Avisos */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-4">
          <span className="material-symbols-outlined text-blue-600 text-2xl shrink-0">info</span>
          <div>
            <h4 className="font-bold text-blue-900 mb-1">Como funciona a base CUB?</h4>
            <p className="text-sm text-blue-800">
              O Custo Unitário Básico é publicado mensalmente. Para que o <strong>Orçamento Base</strong> seja preciso, mantenha as planilhas do estado desejado sempre atualizadas com o mês vigente. Atualmente o sistema aceita tabelas no formato desonerado.
            </p>
          </div>
        </div>

        {/* Lista de Bases Atuais */}
        <div className="bg-white rounded-xl shadow-sm border border-[#e1e2e8] overflow-hidden">
          <div className="p-5 border-b border-[#e1e2e8]">
            <h3 className="font-bold text-[#191c1e]">Bases Regionais Instaladas</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e1e2e8]">
                  <th className="px-5 py-3 text-xs font-bold text-[#707785] uppercase tracking-wider">Estado / Sindicato</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#707785] uppercase tracking-wider">Mês Ref.</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#707785] uppercase tracking-wider">Última Atualização</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#707785] uppercase tracking-wider">Projetos Tipificados</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#707785] uppercase tracking-wider text-center">Status</th>
                  <th className="px-5 py-3 text-xs font-bold text-[#707785] uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e1e2e8]">
                {bases.map((base, idx) => (
                  <tr key={idx} className="hover:bg-[#f8fafc] transition-colors cursor-pointer" onClick={() => setViewingBase(base)}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-500">
                          {base.uf}
                        </div>
                        <div>
                          <p className="font-bold text-[#191c1e]">{base.sinduscon_nome}</p>
                          <p className="text-xs text-slate-500">Brasil</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">{base.mes_referencia}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{new Date(base.atualizado_em).toLocaleDateString('pt-BR')}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{base.projetos} tipos disponíveis</td>
                    <td className="px-5 py-4 text-center">
                      {base.status === 'ATUALIZADO' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <span className="material-symbols-outlined text-[12px]">check_circle</span>
                          Mês Atual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          <span className="material-symbols-outlined text-[12px]">warning</span>
                          Desatualizado
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setViewingBase(base); }}
                        className="p-2 text-[#005daa] hover:bg-blue-50 rounded-lg transition-colors" title="Visualizar Tabela CUB"
                      >
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Mock de Importação */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#191c1e]">Importar Tabela CUB</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              {!scrapedData ? (
                <>
                  <p className="text-sm text-slate-600 mb-6">
                    Faça o upload da planilha oficial (formato CSV) ou atualize automaticamente via integração Sinduscon.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Estado (UF)</label>
                      <select 
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none"
                        value={selectedUf}
                        onChange={(e) => setSelectedUf(e.target.value)}
                      >
                        <option value="SP">São Paulo (SP)</option>
                        <option value="MG">Minas Gerais (MG)</option>
                        <option value="RJ">Rio de Janeiro (RJ)</option>
                        <option value="ES">Espírito Santo (ES)</option>
                      </select>
                    </div>
                    
                    {selectedUf === 'ES' ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                        <span className="material-symbols-outlined text-[32px] text-blue-500 mb-2">public</span>
                        <h4 className="font-bold text-blue-900 mb-1">Integração Automática Ativa</h4>
                        <p className="text-sm text-blue-800 mb-4">O sistema é capaz de buscar a planilha oficial deste estado automaticamente ou processar o PDF.</p>
                        
                        <div className="flex justify-center mt-2">
                          <input 
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            id="pdf-upload" 
                            onChange={handlePdfUpload}
                            disabled={isImporting}
                          />
                          <label 
                            htmlFor="pdf-upload"
                            className={`px-4 py-2 border border-[#005daa] text-[#005daa] bg-white rounded-lg font-bold shadow-sm flex items-center gap-2 transition-colors ${isImporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50'}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                            Enviar PDF (CBIC)
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Arquivo Base</label>
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                          <span className="material-symbols-outlined text-[32px] text-slate-400 mb-2">cloud_upload</span>
                          <p className="text-sm font-medium text-slate-600">Clique para selecionar ou arraste o arquivo CSV</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex justify-end gap-3">
                    <button 
                      type="button" 
                      onClick={() => setShowImportModal(false)} 
                      className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                      disabled={isImporting}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button"
                      onClick={selectedUf === 'ES' ? handleScrape : () => alert('Apenas integração automática (ES) habilitada neste teste.')}
                      disabled={isImporting} 
                      className="px-4 py-2 bg-[#005daa] text-white rounded-lg font-bold shadow hover:bg-[#004a88] flex items-center gap-2 disabled:opacity-50"
                    >
                      {isImporting ? (
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">cloud_download</span>
                      )}
                      {isImporting ? 'Processando...' : 'Buscar do Site Sinduscon'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <h4 className="font-bold text-[#191c1e] text-lg">Revisão de Dados - {scrapedData.sinduscon}</h4>
                    <p className="text-sm text-slate-600">Referência: <span className="font-bold">{scrapedData.mesReferencia}</span></p>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[300px]">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 border-b border-slate-200 font-bold">Tipologia</th>
                          <th className="px-4 py-2 border-b border-slate-200 font-bold">Padrão Baixo</th>
                          <th className="px-4 py-2 border-b border-slate-200 font-bold">Padrão Normal</th>
                          <th className="px-4 py-2 border-b border-slate-200 font-bold">Padrão Alto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {scrapedData.valores.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-medium">{item.tipo}</td>
                            <td className="px-4 py-2">{item.baixo ? `R$ ${item.baixo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : '-'}</td>
                            <td className="px-4 py-2">{item.normal ? `R$ ${item.normal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : '-'}</td>
                            <td className="px-4 py-2">{item.alto ? `R$ ${item.alto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-8 flex justify-end gap-3">
                    <button 
                      type="button" 
                      onClick={() => setScrapedData(null)} 
                      className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                      disabled={isSaving}
                    >
                      Voltar
                    </button>
                    <button 
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving} 
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">save</span>
                      )}
                      {isSaving ? 'Salvando...' : 'Confirmar e Salvar Base'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização da Base Instalada */}
      {viewingBase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" onClick={() => setViewingBase(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#191c1e]">{viewingBase.sinduscon_nome}</h3>
                <p className="text-sm text-slate-600">Referência: <span className="font-bold">{viewingBase.mes_referencia}</span></p>
              </div>
              <button onClick={() => setViewingBase(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 border-b border-slate-200 font-bold">Tipologia</th>
                      <th className="px-4 py-2 border-b border-slate-200 font-bold">Padrão Baixo</th>
                      <th className="px-4 py-2 border-b border-slate-200 font-bold">Padrão Normal</th>
                      <th className="px-4 py-2 border-b border-slate-200 font-bold">Padrão Alto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(viewingBase.dados_json) && viewingBase.dados_json.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium">{item.tipo}</td>
                        <td className="px-4 py-2">{item.baixo ? `R$ ${item.baixo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : '-'}</td>
                        <td className="px-4 py-2">{item.normal ? `R$ ${item.normal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : '-'}</td>
                        <td className="px-4 py-2">{item.alto ? `R$ ${item.alto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

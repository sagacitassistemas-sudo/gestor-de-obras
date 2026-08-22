import React, { useState } from 'react';
import { AuthSession } from '../types';

interface ImportacaoBasesAnaliticasViewProps {
  authSession?: AuthSession | null;
}

export const ImportacaoBasesAnaliticasView: React.FC<ImportacaoBasesAnaliticasViewProps> = ({ authSession }) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedOrgao, setSelectedOrgao] = useState('IOPES');
  const [tipoTabela, setTipoTabela] = useState('insumos');
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('Insumos');
  const [activeSubTab, setActiveSubTab] = useState('Material');
  const [insumosList, setInsumosList] = useState<any[]>([]);
  const [servicosList, setServicosList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filtros de Serviços
  const [selectedNivel1, setSelectedNivel1] = useState('');
  const [selectedNivel2, setSelectedNivel2] = useState('');

  React.useEffect(() => {
    if (activeTab === 'Insumos') {
       fetchInsumos();
    } else if (activeTab === 'Servicos') {
       fetchServicos();
    }
  }, [activeTab, activeSubTab]);

  const fetchServicos = async () => {
    if (!authSession?.idToken) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bases-referenciais/servicos`, {
        headers: {
          'Authorization': `Bearer ${authSession.idToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setServicosList(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInsumos = async () => {
    if (!authSession?.idToken) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bases-referenciais/insumos?categoria=${activeSubTab}`, {
        headers: {
          'Authorization': `Bearer ${authSession.idToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setInsumosList(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!authSession?.idToken) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('orgao', selectedOrgao);
    formData.append('mesReferencia', '02/2020'); // TODO: Colher do input futuramente
    formData.append('tipoTabela', tipoTabela);
    
    try {
      const token = authSession?.idToken;
      // Define a rota com base no tipo de tabela selecionado
      const endpoint = tipoTabela === 'insumos' 
          ? '/api/bases-referenciais/import-insumos' 
          : '/api/bases-referenciais/import-servicos';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setImportSummary({
          orgao: selectedOrgao,
          mesReferencia: '02/2020',
          totalMaoDeObra: data.resumo?.totalMaoDeObra || 0,
          totalMaterial: data.resumo?.totalMaterial || 0,
          totalEquipamento: data.resumo?.totalEquipamento || 0
        });
      } else {
        alert(`${data.message || 'Erro ao importar base'}\nDetalhe: ${data.error || ''}`);
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro de conexão ao tentar enviar arquivo');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e1e2e8] p-6 shadow-sm z-10 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#005daa]">account_tree</span>
            Bases Analíticas (IOPES / DER)
          </h2>
          <p className="text-sm text-[#707785] mt-1">
            Gerencie e importe planilhas de referência com detalhamento de insumos (Mão de Obra, Materiais, Equipamentos).
          </p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#005daa] text-white rounded-lg font-bold shadow-sm hover:bg-[#004a88] transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">upload_file</span>
          Importar Nova Tabela
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex border-b border-[#e1e2e8] mb-6">
          <button
            onClick={() => setActiveTab('Insumos')}
            className={`px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'Insumos' ? 'border-[#005daa] text-[#005daa]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            Insumos
          </button>
          <button
            onClick={() => setActiveTab('Servicos')}
            className={`px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'Servicos' ? 'border-[#005daa] text-[#005daa]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            Serviços (Composições)
          </button>
        </div>

        {activeTab === 'Insumos' && (
          <div className="bg-white rounded-xl shadow-sm border border-[#e1e2e8] overflow-hidden flex flex-col min-h-[500px]">
            <div className="flex border-b border-slate-100 bg-slate-50 px-4 pt-2">
              <button
                onClick={() => setActiveSubTab('Material')}
                className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${activeSubTab === 'Material' ? 'bg-white border-t border-l border-r border-slate-200 text-[#005daa]' : 'text-slate-600 hover:bg-slate-200/50'}`}
              >
                Materiais
              </button>
              <button
                onClick={() => setActiveSubTab('Mão-de-obra')}
                className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${activeSubTab === 'Mão-de-obra' ? 'bg-white border-t border-l border-r border-slate-200 text-[#005daa]' : 'text-slate-600 hover:bg-slate-200/50'}`}
              >
                Mão-de-obra
              </button>
              <button
                onClick={() => setActiveSubTab('Equipamento')}
                className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${activeSubTab === 'Equipamento' ? 'bg-white border-t border-l border-r border-slate-200 text-[#005daa]' : 'text-slate-600 hover:bg-slate-200/50'}`}
              >
                Equipamentos
              </button>
            </div>
            
            <div className="p-0 overflow-auto flex-1">
              {isLoading ? (
                <div className="p-10 text-center text-slate-500 font-medium">Carregando insumos...</div>
              ) : insumosList.length === 0 ? (
                <div className="p-10 text-center">
                   <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3">inbox</span>
                   <h4 className="font-bold text-slate-500 mb-1">Nenhum registro encontrado</h4>
                   <p className="text-sm text-slate-400">Clique em "Importar Nova Tabela" para enviar planilhas (IOPES ou DER).</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold">Órgão</th>
                      <th className="px-4 py-3 font-bold">Código</th>
                      <th className="px-4 py-3 font-bold">Descrição</th>
                      <th className="px-4 py-3 font-bold">Unid.</th>
                      <th className="px-4 py-3 font-bold text-right">Preço (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insumosList.map((ins) => (
                      <tr key={ins.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 whitespace-nowrap">{ins.orgao} <span className="text-xs text-slate-400">({ins.mes_ano_ref})</span></td>
                        <td className="px-4 py-3 font-mono text-slate-800 whitespace-nowrap">{ins.codigo}</td>
                        <td className="px-4 py-3">{ins.descricao}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{ins.unidade}</td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                          {ins.preco?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Servicos' && (
          <div className="bg-white rounded-xl shadow-sm border border-[#e1e2e8] overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-[#191c1e] mb-3">Filtros de Serviços</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Grupo (Nível 1)</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none text-sm"
                    value={selectedNivel1}
                    onChange={(e) => {
                      setSelectedNivel1(e.target.value);
                      setSelectedNivel2('');
                    }}
                  >
                    <option value="">Todos os Grupos</option>
                    {servicosList
                      .filter(s => s.item?.length === 2 && !s.codigo_fonte)
                      .map(s => (
                        <option key={s.id} value={s.item}>{s.item} - {s.descricao}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Subgrupo (Nível 2)</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none text-sm"
                    value={selectedNivel2}
                    onChange={(e) => setSelectedNivel2(e.target.value)}
                    disabled={!selectedNivel1}
                  >
                    <option value="">Todos os Subgrupos</option>
                    {servicosList
                      .filter(s => s.item?.length === 4 && !s.codigo_fonte && s.item.startsWith(selectedNivel1))
                      .map(s => (
                        <option key={s.id} value={s.item}>{s.item} - {s.descricao}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-0 overflow-auto flex-1">
              {isLoading ? (
                <div className="p-10 text-center text-slate-500 font-medium">Carregando serviços...</div>
              ) : servicosList.length === 0 ? (
                <div className="p-10 text-center">
                   <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3">construction</span>
                   <h4 className="font-bold text-slate-500 mb-1">Nenhum serviço importado</h4>
                   <p className="text-sm text-slate-400">Clique em "Importar Nova Tabela" e selecione "Planilha de Serviços".</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="px-4 py-3 font-bold">Órgão</th>
                      <th className="px-4 py-3 font-bold">Item</th>
                      <th className="px-4 py-3 font-bold">Código Fonte</th>
                      <th className="px-4 py-3 font-bold">Descrição do Serviço</th>
                      <th className="px-4 py-3 font-bold text-center">Unid.</th>
                      <th className="px-4 py-3 font-bold text-right">Preço Unitário (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {servicosList
                      .filter(srv => {
                        if (selectedNivel2) return srv.item.startsWith(selectedNivel2);
                        if (selectedNivel1) return srv.item.startsWith(selectedNivel1);
                        return true;
                      })
                      .map((srv) => {
                      const isGroup = !srv.codigo_fonte;
                      // Calculated indentation based on item string length (e.g., '01' vs '0102' vs '010201')
                      const indentLevel = srv.item ? Math.max(0, (srv.item.length / 2) - 1) : 0;
                      
                      return (
                        <tr key={srv.id} className={`hover:bg-slate-50/50 ${isGroup ? 'bg-slate-50/30' : ''}`}>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-500">{srv.orgao}</td>
                          <td className={`px-4 py-3 whitespace-nowrap font-mono ${isGroup ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{srv.item}</td>
                          <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{srv.codigo_fonte || '-'}</td>
                          <td className={`px-4 py-3 ${isGroup ? 'font-bold text-slate-900' : 'text-slate-700'}`} style={{ paddingLeft: `${1 + indentLevel * 1.5}rem` }}>
                            {srv.descricao}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">{srv.unidade || '-'}</td>
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                            {srv.preco_unitario ? srv.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modal de Importação */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#191c1e]">Importar Tabela Analítica</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6">
              {!importSummary ? (
                <>
                  <p className="text-sm text-slate-600 mb-6">
                    Selecione o órgão emissor e envie a planilha (Excel) correspondente. O sistema varrerá as categorias (Mão de Obra, Material e Equipamento).
                  </p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Órgão Emissor</label>
                        <select 
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none"
                          value={selectedOrgao}
                          onChange={(e) => setSelectedOrgao(e.target.value)}
                        >
                          <option value="IOPES">IOPES (Índice de Obras Públicas ES)</option>
                          <option value="DER">DER (Departamento de Edificações e Rodovias ES)</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Tabela</label>
                        <select 
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none"
                          value={tipoTabela}
                          onChange={(e) => setTipoTabela(e.target.value)}
                        >
                          <option value="insumos">Planilha de Insumos</option>
                          <option value="servicos">Planilha de Serviços</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Arquivo Base (.xlsx)</label>
                      
                      <div className="relative">
                        <input 
                          type="file" 
                          accept=".xlsx,.xls" 
                          className="hidden" 
                          id="excel-upload" 
                          onChange={handleFileUpload}
                          disabled={isImporting}
                        />
                        <label 
                          htmlFor="excel-upload"
                          className={`border-2 border-dashed border-[#005daa] bg-blue-50 text-[#005daa] rounded-xl p-8 text-center transition-colors flex flex-col items-center justify-center ${isImporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-100'}`}
                        >
                          {isImporting ? (
                            <>
                              <span className="material-symbols-outlined animate-spin text-[32px] mb-2">progress_activity</span>
                              <span className="font-bold">Analisando planilhas...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[32px] mb-2">upload_file</span>
                              <span className="font-bold">Clique para selecionar o arquivo</span>
                              <span className="text-xs mt-1">Formatos suportados: .xlsx</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                     <span className="material-symbols-outlined text-[48px] text-emerald-500 mb-2">check_circle</span>
                     <h4 className="font-bold text-lg text-emerald-900">Análise Concluída</h4>
                     <p className="text-sm text-slate-600">Resumo da leitura do arquivo ({importSummary.orgao} - {importSummary.mesReferencia}):</p>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                     <ul className="space-y-3">
                       <li className="flex justify-between items-center">
                         <span className="font-medium text-slate-700">Mão de Obra</span>
                         <span className="font-bold text-slate-900">{importSummary.totalMaoDeObra} registros</span>
                       </li>
                       <li className="flex justify-between items-center border-t border-slate-200 pt-3">
                         <span className="font-medium text-slate-700">Materiais</span>
                         <span className="font-bold text-slate-900">{importSummary.totalMaterial} registros</span>
                       </li>
                       <li className="flex justify-between items-center border-t border-slate-200 pt-3">
                         <span className="font-medium text-slate-700">Equipamentos</span>
                         <span className="font-bold text-slate-900">{importSummary.totalEquipamento} registros</span>
                       </li>
                     </ul>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button 
                      onClick={() => setImportSummary(null)} 
                      className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => {
                        setShowImportModal(false);
                        setImportSummary(null);
                        alert('Base salva com sucesso!');
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Concluir
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { AuthSession, RefCargoSalario, RefMatrizEncargo, TenantCargoSalario, TenantBdiConfig } from '../types';

interface CustosFinanceiroViewProps {
  authSession: AuthSession | null;
}

export const CustosFinanceiroView: React.FC<CustosFinanceiroViewProps> = ({ authSession }) => {
  const [activeTab, setActiveTab] = useState<'salarios' | 'encargos' | 'bdi'>('salarios');

  // Custos States
  const [refCargos, setRefCargos] = useState<RefCargoSalario[]>([]);
  const [refEncargos, setRefEncargos] = useState<RefMatrizEncargo[]>([]);
  const [tenantCargos, setTenantCargos] = useState<TenantCargoSalario[]>([]);
  const [tenantBdi, setTenantBdi] = useState<TenantBdiConfig[]>([]);

  // Filtros Custos
  const [ufSelecionada, setUfSelecionada] = useState<string>('ES');
  const [tipoTrabalhador, setTipoTrabalhador] = useState<'horista' | 'mensalista'>('horista');
  const [comDesoneracao, setComDesoneracao] = useState<boolean>(true);

  // BDI Form State
  const [bdiFormData, setBdiFormData] = useState({
    obra_id: 'default',
    tipo_composicao: 'SERVICO',
    AC: 3.00,
    SG: 0.80,
    R: 0.97,
    DF: 0.59,
    L: 6.16,
    PIS: 0.65,
    COFINS: 3.00,
    ISS: 5.00,
    CPRB: 4.50
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchCustos = async () => {
    if (!authSession?.idToken) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authSession.idToken}` };
      const [resCargos, resEncargos, resTenant, resBdi] = await Promise.all([
        fetch(`/api/ref-cargos-salarios?uf=${ufSelecionada}`, { headers }),
        fetch(`/api/ref-encargos?uf=${ufSelecionada}`, { headers }),
        fetch(`/api/tenant-cargos`, { headers }),
        fetch(`/api/tenant-bdi`, { headers })
      ]);

      if (resCargos.ok) setRefCargos((await resCargos.json()).data || []);
      if (resEncargos.ok) setRefEncargos((await resEncargos.json()).data || []);
      if (resTenant.ok) setTenantCargos((await resTenant.json()).data || []);
      if (resBdi.ok) {
        const bdis = (await resBdi.json()).data || [];
        setTenantBdi(bdis);
        if (bdis.length > 0) {
          const first = bdis[0];
          setBdiFormData({
            obra_id: first.obra_id || 'default',
            tipo_composicao: first.tipo_composicao,
            AC: first.taxa_administracao_central,
            SG: first.taxa_seguro_garantia,
            R: first.taxa_risco,
            DF: first.taxa_despesas_financeiras,
            L: first.taxa_lucro,
            PIS: first.tributo_pis,
            COFINS: first.tributo_cofins,
            ISS: first.tributo_iss,
            CPRB: first.tributo_cprb || 0
          });
        }
      }
    } catch (e) {
      console.error("Erro ao buscar dados de custos:", e);
      showNotification('error', 'Erro ao carregar dados de custos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustos();
  }, [authSession, ufSelecionada]);

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-2xs border ${
          notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 
          notification.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
          'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">
              {notification.type === 'success' ? 'check_circle' : notification.type === 'error' ? 'error' : 'info'}
            </span>
            <span className="text-sm font-bold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-2xl">account_balance</span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Módulo de Custos & Financeiro
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de custos orçamentários, encargos trabalhistas e formação de preços.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('salarios')}
            className={`px-3 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'salarios'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">payments</span>
            Tabela Salarial
          </button>
          <button
            onClick={() => setActiveTab('encargos')}
            className={`px-3 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'encargos'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">monitoring</span>
            Encargos Sociais
          </button>
          <button
            onClick={() => setActiveTab('bdi')}
            className={`px-3 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'bdi'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">calculate</span>
            Calculadora BDI
          </button>
        </div>
      </div>

      {loading && <div className="text-center p-8 text-slate-500 font-bold">Carregando dados de custos...</div>}

      {/* ABA 1: TABELA SALARIAL */}
      {!loading && activeTab === 'salarios' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Tabela Salarial de Referência</h3>
              <p className="text-xs text-slate-500 mt-0.5">Valores base e benefícios (SINAPI / CCT) por cargo para a região selecionada.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-slate-700">UF:</span>
                <select 
                  value={ufSelecionada}
                  onChange={(e) => setUfSelecionada(e.target.value)}
                  className="p-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none"
                >
                  <option value="ES">ES - Espírito Santo</option>
                  <option value="SP">SP - São Paulo</option>
                  <option value="RJ">RJ - Rio de Janeiro</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold text-slate-600">CBO</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-600">Cargo</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-600 text-right">Salário Piso</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-600 text-right">Salário Médio</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-600 text-right">CUAI</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-600 text-right">Ferramentas (FC)</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-600 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {refCargos.map((cargo, idx) => (
                  <tr key={cargo.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                    <td className="py-3 px-4 text-xs font-mono text-slate-500">{cargo.codigo_cbo}</td>
                    <td className="py-3 px-4 text-sm font-bold text-slate-800">{cargo.nome_cargo}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-right">R$ {cargo.salario_piso?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-sm text-emerald-700 font-bold text-right">R$ {cargo.salario_medio?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-right">R$ {cargo.cuai_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-right">R$ {cargo.fc_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-center">
                      <button className="text-xs text-emerald-700 hover:underline font-bold">Importar</button>
                    </td>
                  </tr>
                ))}
                {refCargos.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-500">Nenhum cargo encontrado para a UF selecionada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 2: ENCARGOS SOCIAIS */}
      {!loading && activeTab === 'encargos' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Matriz de Encargos Sociais</h3>
              <p className="text-xs text-slate-500 mt-0.5">Tabela SINAPI (8ª Edição) com os Grupos A, B, C, D e E.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setTipoTrabalhador('horista')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${tipoTrabalhador === 'horista' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'}`}
                >Horista</button>
                <button 
                  onClick={() => setTipoTrabalhador('mensalista')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${tipoTrabalhador === 'mensalista' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'}`}
                >Mensalista</button>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <input 
                  type="checkbox" 
                  id="deson" 
                  checked={comDesoneracao} 
                  onChange={(e) => setComDesoneracao(e.target.checked)} 
                  className="w-4 h-4 rounded text-emerald-600" 
                />
                <label htmlFor="deson" className="font-bold text-slate-700 cursor-pointer">Com Desoneração (CPRB)</label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {['A', 'B', 'C', 'D', 'E'].map(grupo => {
              const itens = refEncargos.filter(e => e.grupo === grupo);
              if (itens.length === 0) return null;
              
              const totalGrupo = itens.reduce((acc, curr) => {
                let val = 0;
                if (comDesoneracao && tipoTrabalhador === 'horista') val = curr.pct_com_deson_horista;
                if (comDesoneracao && tipoTrabalhador === 'mensalista') val = curr.pct_com_deson_mensalista;
                if (!comDesoneracao && tipoTrabalhador === 'horista') val = curr.pct_sem_deson_horista;
                if (!comDesoneracao && tipoTrabalhador === 'mensalista') val = curr.pct_sem_deson_mensalista;
                return acc + Number(val);
              }, 0);

              return (
                <div key={grupo} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 p-3 px-4 border-b border-slate-200 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 text-sm">Grupo {grupo}</h4>
                    <span className="font-bold text-emerald-700 text-sm">{totalGrupo.toFixed(2)}%</span>
                  </div>
                  <div className="p-0">
                    <table className="w-full text-left">
                      <tbody>
                        {itens.map((item, idx) => {
                          let val = 0;
                          if (comDesoneracao && tipoTrabalhador === 'horista') val = item.pct_com_deson_horista;
                          if (comDesoneracao && tipoTrabalhador === 'mensalista') val = item.pct_com_deson_mensalista;
                          if (!comDesoneracao && tipoTrabalhador === 'horista') val = item.pct_sem_deson_horista;
                          if (!comDesoneracao && tipoTrabalhador === 'mensalista') val = item.pct_sem_deson_mensalista;
                          
                          return (
                            <tr key={item.id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                              <td className="py-2 px-4 text-xs font-mono text-slate-500 w-24">{item.codigo_item}</td>
                              <td className="py-2 px-4 text-xs text-slate-700">{item.descricao}</td>
                              <td className="py-2 px-4 text-xs font-bold text-slate-800 text-right w-24">{Number(val).toFixed(2)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 3: BDI */}
      {!loading && activeTab === 'bdi' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Calculadora de BDI (Acórdão TCU 2622/2013)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Defina as taxas para calcular o BDI aplicável à obra.</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setBdiFormData(prev => ({...prev, tipo_composicao: 'SERVICO'}))}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${bdiFormData.tipo_composicao === 'SERVICO' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'}`}
              >Serviços</button>
              <button 
                onClick={() => setBdiFormData(prev => ({...prev, tipo_composicao: 'FORNECIMENTO'}))}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${bdiFormData.tipo_composicao === 'FORNECIMENTO' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'}`}
              >Fornecimentos</button>
            </div>
          </div>

          <form className="grid grid-cols-1 md:grid-cols-2 gap-8" onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              const res = await fetch('/api/bdi-calcular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.idToken}` },
                body: JSON.stringify(bdiFormData)
              });
              if(res.ok) {
                showNotification('success', 'Configuração de BDI salva com sucesso.');
                fetchCustos();
              } else {
                showNotification('error', 'Erro ao salvar BDI.');
              }
            } finally { setSaving(false); }
          }}>
            <div className="space-y-4">
              <h4 className="font-bold text-slate-700 text-sm border-b pb-2">Custos Indiretos & Remuneração (%)</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Adm. Central (AC)</label>
                  <input type="number" step="0.01" value={bdiFormData.AC} onChange={e => setBdiFormData(p => ({...p, AC: Number(e.target.value)}))} className="w-full p-2 text-sm border rounded-lg focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Seguro/Garantia (SG)</label>
                  <input type="number" step="0.01" value={bdiFormData.SG} onChange={e => setBdiFormData(p => ({...p, SG: Number(e.target.value)}))} className="w-full p-2 text-sm border rounded-lg focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Riscos (R)</label>
                  <input type="number" step="0.01" value={bdiFormData.R} onChange={e => setBdiFormData(p => ({...p, R: Number(e.target.value)}))} className="w-full p-2 text-sm border rounded-lg focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Desp. Financeiras (DF)</label>
                  <input type="number" step="0.01" value={bdiFormData.DF} onChange={e => setBdiFormData(p => ({...p, DF: Number(e.target.value)}))} className="w-full p-2 text-sm border rounded-lg focus:border-emerald-500 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Lucro (L)</label>
                  <input type="number" step="0.01" value={bdiFormData.L} onChange={e => setBdiFormData(p => ({...p, L: Number(e.target.value)}))} className="w-full p-2 text-sm border rounded-lg border-emerald-200 bg-emerald-50/50 focus:border-emerald-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-700 text-sm border-b pb-2">Tributos sobre Receita (%)</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">PIS</label>
                  <input type="number" step="0.01" value={bdiFormData.PIS} onChange={e => setBdiFormData(p => ({...p, PIS: Number(e.target.value)}))} className="w-full p-2 text-sm border rounded-lg focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">COFINS</label>
                  <input type="number" step="0.01" value={bdiFormData.COFINS} onChange={e => setBdiFormData(p => ({...p, COFINS: Number(e.target.value)}))} className="w-full p-2 text-sm border rounded-lg focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ISS</label>
                  <input type="number" step="0.01" value={bdiFormData.ISS} onChange={e => setBdiFormData(p => ({...p, ISS: Number(e.target.value)}))} className="w-full p-2 text-sm border rounded-lg focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">CPRB</label>
                  <input type="number" step="0.01" value={bdiFormData.CPRB} onChange={e => setBdiFormData(p => ({...p, CPRB: Number(e.target.value)}))} className="w-full p-2 text-sm border rounded-lg focus:border-emerald-500 outline-none" />
                </div>
              </div>

              <div className="mt-6 bg-slate-800 rounded-xl p-5 text-white flex flex-col justify-center items-center">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">BDI CALCULADO</span>
                <span className="text-4xl font-bold text-emerald-400">
                  {(() => {
                    const AC = bdiFormData.AC / 100;
                    const SG = bdiFormData.SG / 100;
                    const R = bdiFormData.R / 100;
                    const DF = bdiFormData.DF / 100;
                    const L = bdiFormData.L / 100;
                    const ISS = bdiFormData.ISS / 100;
                    const PIS = bdiFormData.PIS / 100;
                    const COFINS = bdiFormData.COFINS / 100;
                    const CPRB = bdiFormData.CPRB / 100;
                    
                    const num = (1 + AC + SG + R) * (1 + DF) * (1 + L);
                    const den = 1 - (ISS + PIS + COFINS + CPRB);
                    if (den <= 0) return 'Erro';
                    return (((num / den) - 1) * 100).toFixed(2) + '%';
                  })()}
                </span>
                <button type="submit" disabled={saving} className="mt-4 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors w-full">
                  {saving ? 'Salvando...' : 'Salvar BDI'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ContratoObraResumo } from '../types/cerne.types';
import { EmpresaItem } from '../types';

interface ContratosObraViewProps {
  authSession?: any;
}

export const ContratosObraView: React.FC<ContratosObraViewProps> = ({ authSession }) => {
  const [contratos, setContratos] = useState<ContratoObraResumo[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Data for Form Dropdowns
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);

  // Form State (Inline form replaces Modal based on user previous UI preferences)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    numero_contrato: '',
    projeto_id: '',
    fornecedor_id: '',
    objeto: '',
    valor_global: '',
    data_assinatura: '',
    data_vigencia: '',
    status: 'VIGENTE'
  });

  useEffect(() => {
    fetchContratos();
    fetchDependencies();
  }, []);

  const fetchContratos = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      
      const res = await fetch('/api/contratos-obra', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.contratos) {
        setContratos(json.contratos);
      }
    } catch (err) {
      console.error('Erro ao buscar contratos de obra:', err);
    }
    setLoading(false);
  };

  const fetchDependencies = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;

      const [resEmpresas, resProjetos] = await Promise.all([
        fetch('/api/empresas', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/projetos', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const jsonEmpresas = await resEmpresas.json();
      const jsonProjetos = await resProjetos.json();

      if (jsonEmpresas.data) setEmpresas(jsonEmpresas.data);
      if (jsonProjetos.projetos) setProjetos(jsonProjetos.projetos);
    } catch (err) {
      console.error('Erro ao buscar dependências (empresas/projetos):', err);
    }
  };

  const formatCurrency = (val: number) => {
    if (val == null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleOpenForm = (contrato?: ContratoObraResumo) => {
    if (contrato) {
      setEditingId(contrato.contrato_obra_id);
      // Extrair informações do contrato para preencher o formulário se possível
      // Como a API só retorna resumo, precisamos fazer matching ou assumir que a API de detalhe traria tudo.
      // Para o MVP, vamos preencher o que temos do resumo.
      setFormData({
        numero_contrato: contrato.numero_contrato || '',
        projeto_id: contrato.projeto_id || '',
        fornecedor_id: empresas.find(e => e.nome === contrato.fornecedor_nome)?.id || '', // ideal seria ter fornecedor_id na view
        objeto: contrato.objeto || '',
        valor_global: contrato.valor_global?.toString() || '',
        data_assinatura: contrato.data_assinatura || '',
        data_vigencia: contrato.data_vigencia || '',
        status: contrato.contrato_status || 'VIGENTE'
      });
    } else {
      setEditingId(null);
      setFormData({
        numero_contrato: '',
        projeto_id: '',
        fornecedor_id: '',
        objeto: '',
        valor_global: '',
        data_assinatura: '',
        data_vigencia: '',
        status: 'VIGENTE'
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      
      const val = parseFloat(formData.valor_global.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;

      const payload = {
        id: editingId || undefined,
        ...formData,
        valor_global: val
      };

      const res = await fetch('/api/contratos-obra', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        handleCloseForm();
        fetchContratos();
      } else {
        const error = await res.json();
        alert('Erro ao salvar contrato: ' + (error.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error('Erro de rede ao salvar contrato:', err);
    }
    setIsSaving(false);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;

      const res = await fetch('/api/contratos-obra', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: deletingId })
      });

      if (res.ok) {
        setDeletingId(null);
        fetchContratos();
      } else {
        const error = await res.json();
        alert('Erro ao excluir contrato: ' + (error.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error('Erro de rede ao excluir contrato:', err);
    }
  };

  return (
    <div className="space-y-6">
      {!isFormOpen && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm font-display text-[#191c1e]">Contratos de Obra</h1>
            <p className="text-body-md text-[#707785]">Acompanhamento da execução físico-financeira dos fornecedores</p>
          </div>
          <button 
            onClick={() => handleOpenForm()}
            className="px-4 py-2 bg-[#005daa] text-white rounded-md font-label-bold flex items-center gap-2 hover:bg-[#004a88] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Contrato
          </button>
        </div>
      )}

      {isFormOpen ? (
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden">
          <div className="p-6 border-b border-[#e1e2e8] flex justify-between items-center bg-[#f7f9fb]">
            <h2 className="text-headline-sm font-display text-[#191c1e] font-bold">
              {editingId ? 'Editar Contrato de Obra' : 'Novo Contrato de Obra'}
            </h2>
            <button
              onClick={handleCloseForm}
              className="p-2 text-[#707785] hover:bg-[#e1e2e8] rounded-full transition-colors cursor-pointer flex items-center justify-center"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Número do Contrato <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.numero_contrato}
                  onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
                  placeholder="Ex: CT-2026-001"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa]"
                />
              </div>

              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Fornecedor / Empresa <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.fornecedor_id}
                  onChange={(e) => setFormData({ ...formData, fornecedor_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa]"
                >
                  <option value="">-- Selecione o fornecedor --</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nome} ({emp.cnpj_cpf})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Projeto Vinculado <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.projeto_id}
                  onChange={(e) => setFormData({ ...formData, projeto_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa]"
                >
                  <option value="">-- Selecione o projeto --</option>
                  {projetos.map((proj) => (
                    <option key={proj.id} value={proj.id}>{proj.nome_projeto}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Valor Global (R$)
                </label>
                <input
                  type="text"
                  value={formData.valor_global}
                  onChange={(e) => setFormData({ ...formData, valor_global: e.target.value })}
                  placeholder="Ex: 50000.00"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Objeto do Contrato
                </label>
                <input
                  type="text"
                  value={formData.objeto}
                  onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
                  placeholder="Ex: Execução de fundações profundas"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa]"
                />
              </div>

              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Data de Assinatura
                </label>
                <input
                  type="date"
                  value={formData.data_assinatura}
                  onChange={(e) => setFormData({ ...formData, data_assinatura: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa]"
                />
              </div>

              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Data de Vigência
                </label>
                <input
                  type="date"
                  value={formData.data_vigencia}
                  onChange={(e) => setFormData({ ...formData, data_vigencia: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa]"
                />
              </div>

              <div>
                <label className="block text-sm font-label-bold text-[#191c1e] mb-1">
                  Status Inicial <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa]"
                >
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="VIGENTE">Vigente</option>
                  <option value="ADITIVO">Aditivo</option>
                  <option value="ENCERRADO">Encerrado</option>
                  <option value="RESCINDIDO">Rescindido</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-[#e1e2e8]">
              <button
                type="button"
                onClick={handleCloseForm}
                className="px-5 py-2.5 border border-[#c0c7d6] bg-white text-[#424753] rounded-md font-label-bold hover:bg-[#f7f9fb] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#004a88] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {isSaving && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                {editingId ? 'Salvar Alterações' : 'Criar Contrato'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f2f4f6] text-[#424753] text-[11px] uppercase tracking-wider font-bold">
                  <th className="px-4 py-3 border-b border-[#e1e2e8]">Número / Fornecedor</th>
                  <th className="px-4 py-3 border-b border-[#e1e2e8]">Projeto Vinculado</th>
                  <th className="px-4 py-3 border-b border-[#e1e2e8] text-right">Valor Global (R$)</th>
                  <th className="px-4 py-3 border-b border-[#e1e2e8] text-right">Medido Acum. (R$)</th>
                  <th className="px-4 py-3 border-b border-[#e1e2e8] text-center">Status</th>
                  <th className="px-4 py-3 border-b border-[#e1e2e8] text-center">Avanço %</th>
                  <th className="px-4 py-3 border-b border-[#e1e2e8] text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-[#707785]">Carregando contratos...</td>
                  </tr>
                )}
                {!loading && contratos.map(c => (
                  <tr key={c.contrato_obra_id} className="border-b border-[#e1e2e8] hover:bg-[#f7f9fb]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#191c1e]">{c.numero_contrato}</div>
                      <div className="text-[11px] text-[#707785]">{c.fornecedor_nome}</div>
                    </td>
                    <td className="px-4 py-3 text-[#191c1e]">
                      {c.nome_projeto || <span className="text-rose-500 text-[10px] uppercase font-bold">Não Vinculado</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(c.valor_global)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#10b981]">
                      {formatCurrency(c.medicao_valor_acumulado)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        c.contrato_status === 'VIGENTE' ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-[#f3f4f6] text-[#4b5563]'
                      }`}>
                        {c.contrato_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-[#005daa]">{Number(c.percentual_executado).toFixed(1)}%</span>
                        <div className="w-16 bg-slate-200 rounded-full h-1.5">
                          <div className="bg-[#005daa] h-1.5 rounded-full" style={{ width: `${Math.min(Number(c.percentual_executado), 100)}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenForm(c)}
                          className="p-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors cursor-pointer flex items-center justify-center"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeletingId(c.contrato_obra_id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors cursor-pointer flex items-center justify-center"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && contratos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-[#707785]">
                      Nenhum contrato de obra encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 border border-[#c0c7d6] shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-[#ef4444]">
              <span className="material-symbols-outlined text-[28px]">warning</span>
              <h3 className="font-headline-sm text-lg font-bold text-[#191c1e]">Confirmar Exclusão</h3>
            </div>
            <p className="text-body-md text-[#404753] mb-6">
              Tem certeza de que deseja excluir permanentemente este contrato de obra?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 border border-[#c0c7d6] rounded-md font-label-bold text-[#404753] hover:bg-[#f2f4f6] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-[#ef4444] text-white rounded-md font-label-bold hover:bg-[#dc2626] cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


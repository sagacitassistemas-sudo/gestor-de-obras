import React, { useState } from 'react';

interface EtapaSimulada {
  id: string;
  nome: string;
  percentual: number;
  valorCalculado: number;
  decomposicao: {
    mo: number;
    mat: number;
    eqp: number;
  };
}

interface CriarProjetoSimuladoModalProps {
  isOpen: boolean;
  onClose: () => void;
  orcamentoBase: number;
  areaTotal: number;
  simulacao_id?: string;
  etapas: EtapaSimulada[];
  authSession: any; // ID Token
  onNavigateTab?: (tab: string) => void;
}

export const CriarProjetoSimuladoModal: React.FC<CriarProjetoSimuladoModalProps> = ({
  isOpen,
  onClose,
  orcamentoBase,
  areaTotal,
  simulacao_id,
  etapas,
  authSession,
  onNavigateTab
}) => {
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [empresaId, setEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/empresas', {
        headers: { 'Authorization': `Bearer ${authSession?.idToken}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) setEmpresas(data.data || []);
      })
      .catch(err => console.error("Erro ao buscar empresas:", err));
    }
  }, [isOpen, authSession]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeProjeto || !dataInicio) {
      setErrorMsg("Por favor, preencha o nome e a data de início.");
      return;
    }
    
    setLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        nome_projeto: nomeProjeto,
        data_inicio: dataInicio,
        empresa_id: empresaId || null,
        orcamento_base: orcamentoBase,
        area_total: areaTotal,
        etapas: etapas,
        simulacao_id
      };

      const res = await fetch('/api/projetos/from-simulacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar projeto');
      }

      // Sucesso! O Módulo I vai precisar puxar esse projeto depois. Redirecionar.
      if (onNavigateTab) {
        onNavigateTab('cronograma_executivo');
      }
      onClose();

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-[#005daa] to-[#004a88] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px]">rocket_launch</span>
            <h3 className="text-lg font-bold">Gerar Projeto Real</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-slate-600 mb-6">
            Isso converterá sua simulação em um projeto real (Módulo I), gerando as {etapas.length} etapas analíticas baseadas no orçamento de <strong>{Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orcamentoBase)}</strong>.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nome do Projeto</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Edifício Alpha"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none"
                value={nomeProjeto}
                onChange={e => setNomeProjeto(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Empresa Executora (Opcional)</label>
              <select 
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none"
                value={empresaId}
                onChange={e => setEmpresaId(e.target.value)}
              >
                <option value="">-- Selecione uma empresa --</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Data de Início Prevista</label>
              <input 
                type="date" 
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border rounded-lg font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-4 py-2 bg-[#005daa] text-white rounded-lg font-bold shadow hover:bg-[#004a88] flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">done</span>
              )}
              {loading ? 'Gerando...' : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

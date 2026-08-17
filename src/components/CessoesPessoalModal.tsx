import React, { useState, useEffect } from 'react';
import { EquipeItem, EquipeMembroItem } from '../types';

interface CessoesPessoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipeOrigem: EquipeItem;
  authSession: any;
  onSuccess: () => void;
}

export const CessoesPessoalModal: React.FC<CessoesPessoalModalProps> = ({
  isOpen, onClose, equipeOrigem, authSession, onSuccess
}) => {
  const [equipes, setEquipes] = useState<EquipeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    funcionario_id: '',
    equipe_destino_id: '',
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    motivo: ''
  });

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/equipes', {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          // Filtrar equipe origem e inativas
          setEquipes(data.data.filter((e: EquipeItem) => e.id !== equipeOrigem.id && e.status !== 'INATIVA'));
        }
      })
      .catch(err => console.error("Erro ao carregar equipes:", err))
      .finally(() => setLoading(false));
    }
  }, [isOpen, authSession, equipeOrigem.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.funcionario_id || !formData.equipe_destino_id) {
      setError("Selecione um funcionário e uma equipe de destino.");
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/cessoes-pessoal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.idToken}`
        },
        body: JSON.stringify({
          funcionario_id: formData.funcionario_id,
          equipe_origem_id: equipeOrigem.id,
          equipe_destino_id: formData.equipe_destino_id,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim || undefined,
          motivo: formData.motivo
        })
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Erro ao registrar cessão.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#005daa]">swap_horiz</span>
            Ceder Funcionário
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Funcionário a ser cedido *</label>
            <select
              value={formData.funcionario_id}
              onChange={e => setFormData({ ...formData, funcionario_id: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm"
            >
              <option value="">Selecione...</option>
              {equipeOrigem.membros?.map(m => (
                <option key={m.funcionario_id} value={m.funcionario_id}>
                  {m.nome} - {m.cargo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Equipe de Destino *</label>
            <select
              value={formData.equipe_destino_id}
              onChange={e => setFormData({ ...formData, equipe_destino_id: e.target.value })}
              required
              disabled={loading}
              className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm"
            >
              <option value="">{loading ? "Carregando..." : "Selecione..."}</option>
              {equipes.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nome} ({eq.empresa_nome})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data de Início *</label>
              <input
                type="date"
                required
                value={formData.data_inicio}
                onChange={e => setFormData({ ...formData, data_inicio: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data Fim (Planejado)</label>
              <input
                type="date"
                value={formData.data_fim}
                onChange={e => setFormData({ ...formData, data_fim: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Motivo / Observações</label>
            <textarea
              rows={3}
              value={formData.motivo}
              onChange={e => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Descreva o motivo da cessão..."
              className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm resize-none"
            />
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold bg-[#005daa] text-white rounded-lg hover:bg-[#004a88] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <span className="material-symbols-outlined animate-spin text-sm">autorenew</span> : null}
            Registrar Cessão
          </button>
        </div>
      </div>
    </div>
  );
};

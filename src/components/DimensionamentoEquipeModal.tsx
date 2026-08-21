import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AuthSession } from '../types';

interface DimensionamentoEquipeModalProps {
  authSession: AuthSession | null;
  equipeId: string;
  equipeNome: string;
  onClose: () => void;
  onSaved: () => void;
}

interface Especialidade {
  id: string;
  nome: string;
  valor_hora: number;
}

interface Composicao {
  especialidade_id: string;
  quantidade: number;
  valor_hora_projetado: number;
  nome?: string;
}

export function DimensionamentoEquipeModal({
  authSession,
  equipeId,
  equipeNome,
  onClose,
  onSaved
}: DimensionamentoEquipeModalProps) {
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [composicao, setComposicao] = useState<Composicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [equipeId]);

  const fetchData = async () => {
    if (!authSession) return;
    setLoading(true);
    try {
      // Fetch especialidades
      const resEsp = await fetch('/api/especialidades', {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      });
      const dataEsp = await resEsp.json();
      if (!dataEsp.success) throw new Error(dataEsp.error);
      
      // Fetch current composicao
      const resComp = await fetch(`/api/equipe-composicao?equipe_id=${equipeId}`, {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      });
      const dataComp = await resComp.json();
      if (!dataComp.success) throw new Error(dataComp.error);

      setEspecialidades(dataEsp.data);
      
      const compMapped = dataComp.data.map((c: any) => ({
        especialidade_id: c.especialidade_id,
        quantidade: c.quantidade,
        valor_hora_projetado: c.valor_hora_projetado,
        nome: c.especialidades?.nome
      }));
      setComposicao(compMapped);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEspecialidade = (esp: Especialidade) => {
    const exists = composicao.find(c => c.especialidade_id === esp.id);
    if (exists) {
      setComposicao(composicao.filter(c => c.especialidade_id !== esp.id));
    } else {
      setComposicao([...composicao, {
        especialidade_id: esp.id,
        quantidade: 1,
        valor_hora_projetado: esp.valor_hora || 0,
        nome: esp.nome
      }]);
    }
  };

  const handleQuantityChange = (espId: string, delta: number) => {
    setComposicao(composicao.map(c => {
      if (c.especialidade_id === espId) {
        const novaQtd = Math.max(1, c.quantidade + delta);
        return { ...c, quantidade: novaQtd };
      }
      return c;
    }));
  };

  const handleSave = async () => {
    if (!authSession) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/equipe-composicao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.idToken}`
        },
        body: JSON.stringify({
          equipe_id: equipeId,
          composicao: composicao.map(c => ({
            especialidade_id: c.especialidade_id,
            quantidade: c.quantidade,
            valor_hora_projetado: c.valor_hora_projetado
          }))
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Dimensionamento da Equipe</h2>
            <p className="text-sm text-slate-500">{equipeNome}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 mb-4">Selecione as especialidades e defina a quantidade estimada para esta OS:</p>
              
              {especialidades.map(esp => {
                const isSelected = composicao.some(c => c.especialidade_id === esp.id);
                const compItem = composicao.find(c => c.especialidade_id === esp.id);

                return (
                  <div 
                    key={esp.id} 
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleEspecialidade(esp)}
                          className="w-5 h-5 border-2 border-slate-300 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                      <div>
                        <p className={`font-bold ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{esp.nome}</p>
                        <p className="text-xs text-slate-500">R$ {esp.valor_hora.toFixed(2)} /h (base)</p>
                      </div>
                    </label>

                    {isSelected && compItem && (
                      <div className="flex items-center gap-3 bg-white px-2 py-1.5 rounded-lg border border-blue-100 shadow-sm">
                        <span className="text-xs font-bold text-slate-500 uppercase">Qtd:</span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleQuantityChange(esp.id, -1)}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">remove</span>
                          </button>
                          <span className="w-8 text-center font-bold text-slate-700">{compItem.quantidade}</span>
                          <button 
                            onClick={() => handleQuantityChange(esp.id, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {especialidades.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  Nenhuma especialidade cadastrada. Vá em "Engenharia &gt; Especialidades" para cadastrar.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2.5 bg-[#005daa] text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Dimensionamento'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

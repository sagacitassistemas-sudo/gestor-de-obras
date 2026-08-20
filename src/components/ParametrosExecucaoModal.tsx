import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ItemEap {
  id: string;
  eap_codigo: string;
  descricao_servico: string;
  e_analitico: boolean;
  quantidade_contratada?: number;
  duracao_dias?: number;
}

interface ParametrosExecucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  projetoId: string;
  onSuccess: () => void;
}

export const ParametrosExecucaoModal: React.FC<ParametrosExecucaoModalProps> = ({
  isOpen,
  onClose,
  projetoId,
  onSuccess,
}) => {
  const [items, setItems] = useState<ItemEap[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Parâmetros locais de edição
  const [params, setParams] = useState<Record<string, { hh_unitario: number, tamanho_equipe: number }>>({});
  const jornadaDiaria = 8.0;

  useEffect(() => {
    if (isOpen && projetoId) {
      loadItems();
    }
  }, [isOpen, projetoId]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('itens_eap')
        .select('*')
        .eq('projeto_id', projetoId)
        .eq('e_analitico', true)
        .order('eap_codigo');

      if (error) throw error;
      setItems(data || []);

      // Initialize default params based on existing duracao if possible
      const initialParams: any = {};
      (data || []).forEach((item: any) => {
        initialParams[item.id] = {
          hh_unitario: 1.0, // Default mock
          tamanho_equipe: 1, // Default mock
        };
      });
      setParams(initialParams);

    } catch (err: any) {
      alert("Erro ao carregar itens da EAP: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleParamChange = (id: string, field: 'hh_unitario' | 'tamanho_equipe', value: number) => {
    setParams(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const calculateDuration = (id: string, qtd: number) => {
    const p = params[id];
    if (!p) return 1;
    const totalHH = p.hh_unitario * qtd;
    const dias = totalHH / (p.tamanho_equipe * jornadaDiaria);
    return Math.max(1, Math.ceil(dias));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Salva de volta a duração calculada nos itens da EAP
      const updates = items.map(item => ({
        id: item.id,
        duracao_dias: calculateDuration(item.id, item.quantidade_contratada || 1)
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('itens_eap')
          .update({ duracao_dias: update.duracao_dias })
          .eq('id', update.id);
        
        if (error) throw error;
      }
      
      alert("Produtividade parametrizada com sucesso! Durações atualizadas.");
      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 bg-gradient-to-r from-[#005daa] to-[#004a88] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px]">engineering</span>
            <h3 className="text-lg font-bold">Parametrização de Produtividade (H/H)</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center p-12 text-slate-500">Carregando itens...</div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="p-3 font-bold text-slate-700">EAP</th>
                  <th className="p-3 font-bold text-slate-700">Serviço</th>
                  <th className="p-3 font-bold text-slate-700 text-right">Qtd</th>
                  <th className="p-3 font-bold text-slate-700 text-center">H/H por Unid.</th>
                  <th className="p-3 font-bold text-slate-700 text-center">Tamanho Equipe</th>
                  <th className="p-3 font-bold text-slate-700 text-right">Duração (Dias)</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const qtd = item.quantidade_contratada || 1;
                  const duracao = calculateDuration(item.id, qtd);
                  return (
                    <tr key={item.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-500">{item.eap_codigo}</td>
                      <td className="p-3 font-bold">{item.descricao_servico}</td>
                      <td className="p-3 text-right font-mono">{qtd.toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={params[item.id]?.hh_unitario || ''}
                          onChange={e => handleParamChange(item.id, 'hh_unitario', parseFloat(e.target.value) || 1)}
                          className="w-20 border rounded p-1 text-center font-mono focus:border-blue-500 focus:ring-1 outline-none"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={params[item.id]?.tamanho_equipe || ''}
                          onChange={e => handleParamChange(item.id, 'tamanho_equipe', parseInt(e.target.value) || 1)}
                          className="w-16 border rounded p-1 text-center font-mono focus:border-blue-500 focus:ring-1 outline-none"
                        />
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 bg-emerald-50">
                        {duracao}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg font-bold text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[#005daa] text-white rounded-lg font-bold shadow hover:bg-[#004a88]">
            {saving ? 'Salvando...' : 'Aplicar Durações'}
          </button>
        </div>
      </div>
    </div>
  );
};

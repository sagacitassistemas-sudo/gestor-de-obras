import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthSession, EspecialidadeItem } from '../types';

interface GestaoCompetenciasModalProps {
  especialidade: EspecialidadeItem;
  authSession: AuthSession | null;
  onClose: () => void;
}

export const GestaoCompetenciasModal: React.FC<GestaoCompetenciasModalProps> = ({ especialidade, authSession, onClose }) => {
  const [competencias, setCompetencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    eixo: 'Tecnicas',
    descricao: '',
    peso_esperado: 3,
    treinamento_obrigatorio: ''
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchCompetencias = async () => {
    setLoading(true);
    try {
      const token = authSession?.idToken;
      if (!token) return;

      const res = await fetch(`/api/competencias/especialidade/${especialidade.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setCompetencias(json.competencias || []);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Erro ao carregar competências.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetencias();
  }, [especialidade.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao.trim()) {
      showNotification('error', 'Preencha a descrição da competência.');
      return;
    }

    setSaving(true);
    try {
      const token = authSession?.idToken;
      
      const payload = {
        especialidade_id: especialidade.id,
        ...formData
      };

      const res = await fetch('/api/competencias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showNotification('success', 'Competência adicionada com sucesso!');
        setFormData({ ...formData, descricao: '', treinamento_obrigatorio: '' });
        fetchCompetencias();
      } else {
        const err = await res.json();
        showNotification('error', err.error || 'Erro ao adicionar competência.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta competência?')) return;
    try {
      const token = authSession?.idToken;

      const res = await fetch(`/api/competencias/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        showNotification('success', 'Competência removida.');
        fetchCompetencias();
      } else {
        showNotification('error', 'Erro ao remover competência.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    }
  };

  const agrupadas = competencias.reduce((acc: any, c: any) => {
    if (!acc[c.eixo]) acc[c.eixo] = [];
    acc[c.eixo].push(c);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#005daa]">{especialidade.icone || 'engineering'}</span>
              Competências: {especialidade.nome}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Gerencie o catálogo de habilidades, RDO e NRs esperadas para este cargo.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-2 shadow-sm">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-6 overflow-y-auto grow flex flex-col md:flex-row gap-6">
          
          {/* Left Column: List */}
          <div className="flex-1 space-y-6">
            {notification && (
              <div className={`p-3 rounded-lg text-sm font-bold ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {notification.message}
              </div>
            )}

            {loading ? (
              <p className="text-center text-gray-500 py-8">Carregando catálogo...</p>
            ) : (
              <div className="space-y-6">
                {['Tecnicas', 'Calculo', 'Comunicacao', 'SSMA'].map((eixo) => (
                  <div key={eixo} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 font-bold text-gray-700 text-sm border-b border-gray-200 uppercase tracking-wider flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-gray-500">
                        {eixo === 'Tecnicas' ? 'handyman' : eixo === 'Calculo' ? 'calculate' : eixo === 'Comunicacao' ? 'forum' : 'security'}
                      </span>
                      {eixo}
                    </div>
                    <div className="p-0">
                      {(!agrupadas[eixo] || agrupadas[eixo].length === 0) ? (
                        <p className="text-xs text-gray-400 italic p-4 text-center">Nenhuma competência cadastrada neste eixo.</p>
                      ) : (
                        <ul className="divide-y divide-gray-100">
                          {agrupadas[eixo].map((comp: any) => (
                            <li key={comp.id} className="p-4 hover:bg-gray-50 flex items-start justify-between gap-4 group">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{comp.descricao}</p>
                                <div className="flex gap-3 mt-1">
                                  <span className="text-xs text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                    Peso: {comp.peso_esperado}
                                  </span>
                                  {comp.treinamento_obrigatorio && (
                                    <span className="text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                      NR exigida: {comp.treinamento_obrigatorio}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button 
                                onClick={() => handleDelete(comp.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remover competência"
                              >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Add Form */}
          <div className="w-full md:w-80 shrink-0">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 sticky top-0">
              <h3 className="font-bold text-blue-800 text-sm mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">add_task</span>
                Adicionar Competência
              </h3>
              
              <form onSubmit={handleAdd} className="space-y-4 text-sm">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1 text-xs">Eixo *</label>
                  <select
                    value={formData.eixo}
                    onChange={(e) => setFormData({ ...formData, eixo: e.target.value })}
                    className="w-full p-2 border border-blue-200 rounded-lg focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="Tecnicas">Técnicas (Hard Skills)</option>
                    <option value="Calculo">Cálculo e Medição</option>
                    <option value="Comunicacao">Comunicação e RDO</option>
                    <option value="SSMA">SSMA (Segurança e Meio Amb.)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1 text-xs">Descrição da Competência *</label>
                  <textarea
                    rows={3}
                    required
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Ex: Confecção e montagem de fôrmas..."
                    className="w-full p-2 border border-blue-200 rounded-lg focus:border-blue-500 outline-none bg-white resize-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1 text-xs flex justify-between">
                    Peso Esperado (1 a 5) *
                    <span className="text-blue-600 font-bold">{formData.peso_esperado}</span>
                  </label>
                  <input
                    type="range"
                    min="1" max="5" step="1"
                    value={formData.peso_esperado}
                    onChange={(e) => setFormData({ ...formData, peso_esperado: Number(e.target.value) })}
                    className="w-full accent-[#005daa]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-bold px-1">
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                  </div>
                </div>

                {formData.eixo === 'SSMA' && (
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1 text-xs">NR / Curso Obrigatório (Opcional)</label>
                    <input
                      type="text"
                      value={formData.treinamento_obrigatorio}
                      onChange={(e) => setFormData({ ...formData, treinamento_obrigatorio: e.target.value })}
                      placeholder="Ex: NR-18, NR-35"
                      className="w-full p-2 border border-blue-200 rounded-lg focus:border-blue-500 outline-none bg-white"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2 bg-[#005daa] hover:bg-[#004a88] text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {saving ? 'Adicionando...' : 'Incluir no Catálogo'}
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

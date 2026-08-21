import React, { useState, useEffect } from 'react';

interface Calendario {
  id: string;
  nome: string;
  carga_dom: number;
  carga_seg: number;
  carga_ter: number;
  carga_qua: number;
  carga_qui: number;
  carga_sex: number;
  carga_sab: number;
}

interface Excecao {
  id: string;
  calendario_id: string;
  data_excecao: string;
  descricao: string;
  tipo: string;
  carga_horaria: number;
}

export function CalendariosView({ authSession }: { authSession: any }) {
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [selectedCalendario, setSelectedCalendario] = useState<Calendario | null>(null);
  const [excecoes, setExcecoes] = useState<Excecao[]>([]);
  
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<Calendario>>({});
  
  const [isCreatingExcecao, setIsCreatingExcecao] = useState(false);
  const [excecaoForm, setExcecaoForm] = useState<Partial<Excecao>>({ tipo: 'FERIADO', carga_horaria: 0 });

  useEffect(() => {
    fetchCalendarios();
  }, []);

  const fetchCalendarios = async () => {
    try {
      const res = await fetch('/api/calendarios', {
        headers: { Authorization: `Bearer ${authSession?.idToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setCalendarios(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExcecoes = async (calId: string) => {
    try {
      const res = await fetch(`/api/calendarios/${calId}/excecoes`, {
        headers: { Authorization: `Bearer ${authSession?.idToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setExcecoes(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCalendario = (cal: Calendario) => {
    setSelectedCalendario(cal);
    setIsCreating(false);
    fetchExcecoes(cal.id);
  };

  const handleSaveCalendario = async () => {
    try {
      await fetch('/api/calendarios', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${authSession?.idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      setIsCreating(false);
      fetchCalendarios();
    } catch (err) {
      alert("Erro ao salvar calendário.");
    }
  };

  const handleSaveExcecao = async () => {
    if (!selectedCalendario) return;
    try {
      await fetch(`/api/calendarios/${selectedCalendario.id}/excecoes`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${authSession?.idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(excecaoForm)
      });
      setIsCreatingExcecao(false);
      fetchExcecoes(selectedCalendario.id);
      setExcecaoForm({ tipo: 'FERIADO', carga_horaria: 0 });
    } catch (err) {
      alert("Erro ao salvar exceção.");
    }
  };

  const handleDeleteExcecao = async (id: string) => {
    if (!confirm('Deseja excluir esta exceção?')) return;
    try {
      await fetch('/api/calendarios/excecoes', {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${authSession?.idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      if (selectedCalendario) fetchExcecoes(selectedCalendario.id);
    } catch (err) {
      alert("Erro ao excluir exceção.");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e1e2e8] flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#005daa] flex items-center gap-2">
          <span className="material-symbols-outlined">calendar_month</span>
          Calendários de Trabalho
        </h2>
        <button 
          onClick={() => { setIsCreating(true); setSelectedCalendario(null); setFormData({ carga_dom: 0, carga_seg: 8, carga_ter: 8, carga_qua: 8, carga_qui: 8, carga_sex: 8, carga_sab: 0 }); }}
          className="bg-[#005daa] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#004a88]"
        >
          Novo Calendário
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left Column: List */}
        <div className="w-1/3 bg-white rounded-xl shadow-sm border border-[#e1e2e8] overflow-y-auto p-4 space-y-2">
          {calendarios.length === 0 ? (
            <p className="text-center text-[#707785] mt-4">Nenhum calendário cadastrado.</p>
          ) : (
            calendarios.map(cal => (
              <div 
                key={cal.id} 
                onClick={() => handleSelectCalendario(cal)}
                className={`p-4 rounded-lg border cursor-pointer ${selectedCalendario?.id === cal.id ? 'border-[#005daa] bg-blue-50' : 'border-[#e1e2e8] hover:bg-slate-50'}`}
              >
                <h3 className="font-bold text-[#191c1e]">{cal.nome}</h3>
                <p className="text-xs text-[#707785] mt-1">Seg-Sex: {cal.carga_seg}h | Sáb: {cal.carga_sab}h</p>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Details / Form */}
        <div className="w-2/3 bg-white rounded-xl shadow-sm border border-[#e1e2e8] overflow-y-auto p-6">
          {isCreating ? (
            <div>
              <h3 className="text-lg font-bold text-[#191c1e] mb-4">Novo Calendário</h3>
              <div className="mb-4">
                <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Nome do Calendário</label>
                <input 
                  type="text" 
                  value={formData.nome || ''} 
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full border border-[#c0c7d6] rounded-lg p-2 outline-none text-sm"
                  placeholder="Ex: Padrão 44h Semanais"
                />
              </div>
              <div className="grid grid-cols-7 gap-2 mb-6">
                {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].map((dia) => (
                  <div key={dia}>
                    <label className="block text-xs font-bold text-[#707785] uppercase mb-1 capitalize">{dia}</label>
                    <input 
                      type="number" 
                      value={(formData as any)[`carga_${dia}`] || 0}
                      onChange={e => setFormData({ ...formData, [`carga_${dia}`]: Number(e.target.value) })}
                      className="w-full border border-[#c0c7d6] rounded-lg p-2 outline-none text-sm"
                      min="0" max="24"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsCreating(false)} className="px-4 py-2 border rounded-lg font-bold text-[#707785]">Cancelar</button>
                <button onClick={handleSaveCalendario} className="px-4 py-2 bg-[#005daa] text-white rounded-lg font-bold">Salvar</button>
              </div>
            </div>
          ) : selectedCalendario ? (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#191c1e]">{selectedCalendario.nome}</h3>
              </div>
              
              <div className="grid grid-cols-7 gap-2 mb-8 bg-slate-50 p-4 rounded-lg border border-[#e1e2e8]">
                {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].map((dia) => (
                  <div key={dia} className="text-center">
                    <span className="block text-xs font-bold text-[#707785] uppercase capitalize">{dia}</span>
                    <span className="font-bold text-[#191c1e]">{(selectedCalendario as any)[`carga_${dia}`]}h</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-[#191c1e]">Feriados e Exceções</h4>
                <button 
                  onClick={() => setIsCreatingExcecao(true)}
                  className="text-[#005daa] text-sm font-bold flex items-center gap-1 hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span> Adicionar Exceção
                </button>
              </div>

              {isCreatingExcecao && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-100 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-[#707785] mb-1">Data</label>
                    <input type="date" value={excecaoForm.data_excecao || ''} onChange={e => setExcecaoForm({...excecaoForm, data_excecao: e.target.value})} className="w-full border border-[#c0c7d6] rounded p-2 text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-[#707785] mb-1">Descrição</label>
                    <input type="text" placeholder="Ex: Natal" value={excecaoForm.descricao || ''} onChange={e => setExcecaoForm({...excecaoForm, descricao: e.target.value})} className="w-full border border-[#c0c7d6] rounded p-2 text-sm" />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-bold text-[#707785] mb-1">Carga Horária</label>
                    <input type="number" value={excecaoForm.carga_horaria} onChange={e => setExcecaoForm({...excecaoForm, carga_horaria: Number(e.target.value)})} className="w-full border border-[#c0c7d6] rounded p-2 text-sm" />
                  </div>
                  <button onClick={handleSaveExcecao} className="bg-[#005daa] text-white px-4 py-2 rounded font-bold h-[38px]">Salvar</button>
                  <button onClick={() => setIsCreatingExcecao(false)} className="px-4 py-2 text-[#707785] font-bold h-[38px]">Cancelar</button>
                </div>
              )}

              <div className="border border-[#e1e2e8] rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f8fafc] text-[#707785] font-bold border-b border-[#e1e2e8]">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Descrição</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Carga Horária</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {excecoes.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-[#707785]">Nenhuma exceção cadastrada.</td></tr>
                    ) : excecoes.map(exc => (
                      <tr key={exc.id} className="border-b border-[#e1e2e8] last:border-0 hover:bg-slate-50">
                        <td className="p-3 font-medium">{new Date(exc.data_excecao).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                        <td className="p-3">{exc.descricao}</td>
                        <td className="p-3">{exc.tipo}</td>
                        <td className="p-3">{exc.carga_horaria}h</td>
                        <td className="p-3 text-right">
                          <button onClick={() => handleDeleteExcecao(exc.id)} className="text-rose-500 hover:bg-rose-50 p-1 rounded">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[#707785]">
              Selecione um calendário ou crie um novo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

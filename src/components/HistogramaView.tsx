import React, { useState, useEffect, useMemo } from 'react';

interface HistogramaViewProps {
  authSession?: any;
}

interface Projeto {
  id: string;
  nome_projeto: string;
}

interface Composicao {
  especialidade: string;
  quantidade: number;
}

interface OSData {
  os_id: string;
  numero_os: string;
  data_inicio: string;
  data_fim: string;
  composicao: Composicao[];
}

export const HistogramaView: React.FC<HistogramaViewProps> = ({ authSession }) => {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>('');
  const [rawData, setRawData] = useState<OSData[]>([]);
  const [periodicidade, setPeriodicidade] = useState<'mensal' | 'quinzenal'>('mensal');
  const [selectedEspecialidade, setSelectedEspecialidade] = useState<string>('Todas');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar Projetos
  useEffect(() => {
    const fetchProjetos = async () => {
      try {
        const token = authSession?.idToken;
        if (!token) return;
        const response = await fetch('/api/projetos', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const json = await response.json();
          const list = json.projetos || json;
          if (Array.isArray(list)) {
            setProjetos(list);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar projetos:', err);
      }
    };
    fetchProjetos();
  }, [authSession]);

  // Buscar Histograma
  useEffect(() => {
    if (!selectedProjetoId) {
      setRawData([]);
      return;
    }
    const fetchHistograma = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = authSession?.idToken;
        const response = await fetch(`/api/projetos/${selectedProjetoId}/histograma-recursos`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          setRawData(data.data || []);
        } else {
          setError(data.error || 'Erro ao buscar dados.');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistograma();
  }, [selectedProjetoId, authSession]);

  // Especialidades Únicas
  const especialidades = useMemo(() => {
    const set = new Set<string>();
    rawData.forEach(os => {
      os.composicao.forEach(c => set.add(c.especialidade));
    });
    return ['Todas', ...Array.from(set).sort()];
  }, [rawData]);

  // Resetar especialidade selecionada se mudar de projeto
  useEffect(() => {
    setSelectedEspecialidade('Todas');
  }, [selectedProjetoId]);

  // Processar Histograma (Agrupamento Temporal)
  const histogramData = useMemo(() => {
    if (!rawData.length) return [];

    // Encontrar data mínima e máxima globais
    let minDate = new Date('2100-01-01');
    let maxDate = new Date('1900-01-01');

    rawData.forEach(os => {
      const start = new Date(os.data_inicio);
      const end = new Date(os.data_fim);
      if (start < minDate) minDate = start;
      if (end > maxDate) maxDate = end;
    });

    if (minDate > maxDate) return [];

    // Gerar períodos
    const periods: { label: string; start: Date; end: Date; total: number; breakdown: Record<string, number> }[] = [];
    let currentStart = new Date(minDate);

    while (currentStart <= maxDate) {
      let currentEnd = new Date(currentStart);
      let label = '';

      if (periodicidade === 'mensal') {
        currentEnd.setMonth(currentEnd.getMonth() + 1);
        currentEnd.setDate(0); // Último dia do mês
        label = currentStart.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
      } else {
        // Quinzenal
        if (currentStart.getDate() <= 15) {
          currentEnd.setDate(15);
          label = `Q1 ${currentStart.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase()}`;
        } else {
          currentEnd.setMonth(currentEnd.getMonth() + 1);
          currentEnd.setDate(0);
          label = `Q2 ${currentStart.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase()}`;
        }
      }

      periods.push({
        label,
        start: new Date(currentStart),
        end: new Date(currentEnd),
        total: 0,
        breakdown: {}
      });

      // Avançar para o próximo período
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    // Preencher valores
    periods.forEach(period => {
      rawData.forEach(os => {
        const osStart = new Date(os.data_inicio);
        const osEnd = new Date(os.data_fim);

        // Se a OS intercepta o período
        if (osStart <= period.end && osEnd >= period.start) {
          os.composicao.forEach(c => {
            if (selectedEspecialidade === 'Todas' || selectedEspecialidade === c.especialidade) {
              if (!period.breakdown[c.especialidade]) period.breakdown[c.especialidade] = 0;
              period.breakdown[c.especialidade] += c.quantidade;
              period.total += c.quantidade;
            }
          });
        }
      });
    });

    return periods;
  }, [rawData, periodicidade, selectedEspecialidade]);

  const maxTotal = useMemo(() => {
    return Math.max(...histogramData.map(p => p.total), 0);
  }, [histogramData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-title-md font-title-md font-bold text-[#404753]">Histograma de Mão de Obra</h2>
        <p className="text-body-sm font-body-sm text-[#707785]">
          Acompanhe a demanda de profissionais ao longo do tempo (planejamento da EAP cruzado com as equipes das OSs).
        </p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4 items-end shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Projeto
          </label>
          <select
            value={selectedProjetoId}
            onChange={(e) => setSelectedProjetoId(e.target.value)}
            className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] transition-all"
          >
            <option value="">Selecione um projeto...</option>
            {projetos.map(p => (
              <option key={p.id} value={p.id}>{p.nome_projeto}</option>
            ))}
          </select>
        </div>
        
        <div className="w-[180px]">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Especialidade
          </label>
          <select
            value={selectedEspecialidade}
            onChange={(e) => setSelectedEspecialidade(e.target.value)}
            disabled={!selectedProjetoId}
            className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] transition-all disabled:opacity-50"
          >
            {especialidades.map(esp => (
              <option key={esp} value={esp}>{esp}</option>
            ))}
          </select>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setPeriodicidade('quinzenal')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${periodicidade === 'quinzenal' ? 'bg-white shadow text-[#005daa]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Quinzenal
          </button>
          <button
            onClick={() => setPeriodicidade('mensal')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${periodicidade === 'mensal' ? 'bg-white shadow text-[#005daa]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Mensal
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#005daa]"></div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-200">
          {error}
        </div>
      )}

      {!loading && !error && selectedProjetoId && histogramData.length === 0 && (
        <div className="p-12 text-center bg-gray-50 rounded-xl border border-gray-200 text-gray-500">
          <span className="material-symbols-outlined text-[48px] mb-2 opacity-50">event_busy</span>
          <p className="font-medium">Nenhum dado encontrado.</p>
          <p className="text-sm mt-1">Verifique se o projeto possui Ordens de Serviço vinculadas a Equipes e itens da EAP com datas de início e fim.</p>
        </div>
      )}

      {!loading && !error && histogramData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm overflow-hidden flex flex-col">
          <h3 className="text-sm font-bold text-gray-700 mb-8 uppercase tracking-wider">Demanda (Qtd. de Profissionais)</h3>
          
          <div className="flex items-end gap-2 h-64 overflow-x-auto pb-4 custom-scrollbar">
            {histogramData.map((period, idx) => {
              const heightPercentage = maxTotal > 0 ? (period.total / maxTotal) * 100 : 0;
              return (
                <div key={idx} className="flex flex-col items-center gap-2 flex-1 min-w-[60px] group">
                  <span className="text-xs font-bold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {period.total}
                  </span>
                  <div className="w-full bg-blue-100 rounded-t-sm relative flex flex-col justify-end" style={{ height: '100%' }}>
                    <div 
                      className="w-full bg-[#005daa] rounded-t-sm transition-all duration-500 hover:brightness-110" 
                      style={{ height: `${heightPercentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                    {period.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Total por Especialidade (Resumo)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 font-bold text-gray-600">Período</th>
                    <th className="pb-2 font-bold text-gray-600 text-right">Total (Vagas)</th>
                  </tr>
                </thead>
                <tbody>
                  {histogramData.filter(p => p.total > 0).map((period, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-700">{period.label}</td>
                      <td className="py-2.5 font-bold text-[#005daa] text-right">{period.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistogramaView;

import fs from 'fs';
import path from 'path';

const filepath = '/mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/src/components/ProjetosEapView.tsx';
let code = fs.readFileSync(filepath, 'utf8');

// Replace grid classes
code = code.replace(
  /className=\{`grid grid-cols-1 \$\{pipelineState !== 'idle' \? 'xl:grid-cols-5 lg:grid-cols-4' : 'lg:grid-cols-4'\} gap-6 transition-all duration-300 items-start`\}/,
  "className={`grid grid-cols-1 ${pipelineState === 'editing_eap' ? 'xl:grid-cols-5 lg:grid-cols-4' : 'lg:grid-cols-4'} gap-6 transition-all duration-300 items-start`}"
);

code = code.replace(
  /className=\{`bg-white rounded-xl shadow-xs border border-\[#c0c7d6\] overflow-hidden \$\{pipelineState !== 'idle' \? 'xl:col-span-2 lg:col-span-3' : 'lg:col-span-3'\} transition-all duration-300`\}/,
  "className={`bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden ${pipelineState === 'editing_eap' ? 'xl:col-span-2 lg:col-span-3' : 'lg:col-span-3'} transition-all duration-300`}"
);

// Replace drawer condition
code = code.replace(
  /\{\/\* PIPELINE DRAWER \(SIDE PANEL\) \*\/\}\n\s*\{pipelineState !== 'idle' && \(/,
  "{/* PIPELINE DRAWER (SIDE PANEL) */}\n        {pipelineState === 'editing_eap' && ("
);

// Remove the `pipelineState === 'editing_project'` block inside the drawer
// Actually, since we changed the drawer condition to `pipelineState === 'editing_eap'`, the `pipelineState === 'editing_project'` block inside it will just never render. But it's better to remove it.
const regexBlock = /\{\s*pipelineState === 'editing_project' && \(\s*<div className="space-y-5 animate-in fade-in duration-500">[\s\S]*?<\/div>\s*\)\s*\}/;
code = code.replace(regexBlock, '');

// Fix the header of the drawer to only talk about EAP
code = code.replace(
  /\{pipelineState === 'editing_project' \? 'architecture' : 'account_tree'\}/,
  "'account_tree'"
);
code = code.replace(
  /\{pipelineState === 'editing_project' \? \(editingProjeto \? 'Editar Projeto' : 'Novo Projeto'\) : \(editingEap \? 'Editar Etapa EAP' : 'Nova Etapa EAP'\)\}/,
  "{editingEap ? 'Editar Etapa EAP' : 'Nova Etapa EAP'}"
);

// Add the new modal at the end before the last </div>
const modalCode = `
      {/* MODAL PROJETO */}
      {pipelineState === 'editing_project' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191c1e]/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#e1e2e8] bg-[#eff6ff] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#005daa] text-[24px]">architecture</span>
                <h2 className="text-title-lg font-display text-[#005daa] font-bold">
                  {editingProjeto ? 'Editar Projeto' : 'Novo Projeto'}
                </h2>
              </div>
              <button onClick={() => setPipelineState('idle')} className="text-[#005daa] hover:bg-[#d4e3ff] p-1.5 rounded-full transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-5">
                <p className="text-body-sm text-[#404753] mb-4">
                  Cadastre os dados macro do projeto para então habilitar o plano da EAP.
                </p>
                <div>
                  <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Nome do Projeto <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={projetoForm.nome_projeto}
                    onChange={e => setProjetoForm({...projetoForm, nome_projeto: e.target.value})}
                    placeholder="Ex: Condomínio Jardim Europa"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Data de Início <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={projetoForm.data_inicio}
                    onChange={e => setProjetoForm({...projetoForm, data_inicio: e.target.value})}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                  />
                </div>
                
                <div className="pt-6 mt-4 border-t border-[#e2e8f0] flex justify-end gap-3">
                  <button onClick={() => setPipelineState('idle')} className="px-5 py-2.5 border border-[#c0c7d6] text-[#404753] rounded-md font-label-bold hover:bg-[#f2f4f6] transition-colors cursor-pointer">
                    Cancelar
                  </button>
                  <button onClick={saveProjeto} className="px-5 py-2.5 bg-[#005daa] text-white font-label-bold rounded-md hover:bg-[#0075d5] transition-colors cursor-pointer flex items-center gap-2 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Salvar Projeto
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
`;

code = code.replace(/    <\/div>\n  \);\n};\n?$/, modalCode);

fs.writeFileSync(filepath, code);
console.log('Patched ProjetosEapView.tsx');

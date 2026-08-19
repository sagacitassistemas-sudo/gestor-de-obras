const fs = require('fs');
const path = '/mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldCheck = `          {activeTab === 'dispositivos' && (
            (effectivePermissions?.['ADMIN'] || authSession?.decodedToken?.role === 'GESTOR' || effectivePermissions?.['GESTOR']) ? (
              <DispositivosView authSession={authSession} contratoId={authSession?.decodedToken?.contrato_id || ''} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão a Dispositivos</div>
          )}`;

const newCheck = `          {activeTab === 'dispositivos' && (
            (user.role === 'ADMIN' || user.role === 'GESTOR' || effectivePermissions?.usuarios_ler) ? (
              <DispositivosView authSession={authSession} contratoId={authSession?.decodedToken?.contrato_id || ''} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão a Dispositivos</div>
          )}`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync(path, code);
console.log('App.tsx in gestor-de-obras patched successfully.');

import fs from 'fs';
const path = 'src/components/OSView.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /{itensEap\.map\(item => {[\s\S]*?const linkedOs = ordensServico\.find\(os => os\.item_eap_id === item\.id\);[\s\S]*?return \([\s\S]*?<option key={item\.id} value={item\.id} disabled={!!linkedOs} className={linkedOs \? 'text-gray-400 italic' : ''}>[\s\S]*?{item\.eap_codigo} - {item\.descricao_servico} \({item\.unidade_medida}\)[\s\S]*?{linkedOs \? ` \[VINCULADA: \${linkedOs\.numero_os} - \${linkedOs\.status}\]` : ''}[\s\S]*?<\/option>[\s\S]*?\);[\s\S]*?}\)}/,
  `{itensEap.map((item: any) => {
                      const uid = item.id || item.item_eap_id;
                      const linkedOs = ordensServico.find(os => os.item_eap_id === uid);
                      return (
                        <option key={uid} value={uid} disabled={!!linkedOs} className={linkedOs ? 'text-gray-400 italic' : ''}>
                          {item.eap_codigo} - {item.descricao_servico} ({item.unidade_medida})
                          {linkedOs ? \` [VINCULADA: \${linkedOs.numero_os} - \${linkedOs.status}]\` : ''}
                        </option>
                      );
                    })}`
);

fs.writeFileSync(path, code);
console.log('Patched');

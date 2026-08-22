const ExcelJS = require('exceljs');

async function analyze() {
  const workbook = new ExcelJS.Workbook();
  const filePath = '/mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/Refs/IOPES/tab_DER-EDIFICAÇÕES_2020_02_insumos.xlsx';
  
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  let insumos = [];
  
  for (let i = 1; i <= 20; i++) {
      const row = worksheet.getRow(i);
      const codigo = String(row.values[2] || '').trim();
      const descricao = String(row.values[3] || '').trim();
      const unidade = String(row.values[4] || '').trim();
      const precoRaw = row.values[5];
      
      console.log(`Row ${i}: codigo=${codigo}, desc=${descricao}, und=${unidade}, precoRaw=${precoRaw}`);
      
      if (codigo && descricao && codigo !== 'Código' && unidade && unidade !== 'Und.') {
          if (codigo.match(/^'?[0-9]+$/)) {
              console.log(`   --> Match!`);
              insumos.push(codigo);
          } else {
              console.log(`   --> No match regex: ${codigo.match(/^'?[0-9]+$/)}`);
          }
      }
  }
  console.log("Total matched:", insumos.length);
}

analyze();

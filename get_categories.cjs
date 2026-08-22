const ExcelJS = require('exceljs');

async function analyze() {
  const workbook = new ExcelJS.Workbook();
  const filePath = '/mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/Refs/IOPES/tab_DER-EDIFICAÇÕES_2020_02_insumos.xlsx';
  
  try {
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    
    let categories = new Set();
    
    for(let i=1; i<=worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        // values[1] or values[2] could be the text
        const text1 = String(row.values[1] || '').trim();
        const text2 = String(row.values[2] || '').trim();
        if (text1.startsWith('Categoria:')) categories.add(text1);
        if (text2.startsWith('Categoria:')) categories.add(text2);
    }
    
    console.log("Found Categories:");
    for(let c of categories) {
        console.log("- " + c);
    }

  } catch (error) {
    console.error("Error reading excel file:", error);
  }
}

analyze();

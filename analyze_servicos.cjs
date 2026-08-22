const ExcelJS = require('exceljs');

async function analyze() {
  const workbook = new ExcelJS.Workbook();
  const filePath = '/mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/Refs/IOPES/tab_DER-EDIFICAÇÕES_2020_02_servicos.xlsx';
  
  try {
    await workbook.xlsx.readFile(filePath);
    console.log("Worksheets:", workbook.worksheets.map(w => w.name));
    const worksheet = workbook.worksheets[0];
    
    console.log(`\nAnalyzing sheet: ${worksheet.name}`);
    console.log(`Total rows: ${worksheet.rowCount}`);
    
    // Print first 25 rows
    for(let i=1; i<=25; i++) {
        const row = worksheet.getRow(i);
        console.log(`Row ${i}:`, row.values);
    }

  } catch (error) {
    console.error("Error reading excel file:", error);
  }
}

analyze();

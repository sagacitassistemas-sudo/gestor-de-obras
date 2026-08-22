const ExcelJS = require('exceljs');
const fs = require('fs');

async function test() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('./Refs/IOPES/tab_DER-EDIFICAÇÕES_2020_02_servicos.xlsx');
    const worksheet = workbook.worksheets[0];
    
    for (let i = 12; i <= 20; i++) {
        const row = worksheet.getRow(i);
        console.log(`Row ${i}: Item=${row.values[1]}, Codigo=${row.values[2]}, Descricao=${row.values[3]}, Und=${row.values[4]}`);
    }
}
test();

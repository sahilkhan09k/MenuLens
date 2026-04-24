import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile('../Anuvaad_INDB_2024.11.xlsx');
console.log('Sheets:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n=== Sheet: ${sheetName} (${data.length} rows) ===`);
  console.log('Headers:', JSON.stringify(data[0]));
  if (data[1]) console.log('Row 1:', JSON.stringify(data[1]));
  if (data[2]) console.log('Row 2:', JSON.stringify(data[2]));
}

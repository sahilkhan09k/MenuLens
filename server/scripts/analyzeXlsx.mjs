import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile('../Anuvaad_INDB_2024.11.xlsx');
const ws = wb.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(ws);

console.log('Total items:', data.length);
console.log('\nSample food names (first 50):');
data.slice(0, 50).forEach((r, i) => {
  console.log(`${i+1}. [${r.food_code}] ${r.food_name} | ${r.energy_kcal?.toFixed(1)} kcal/100g | P:${r.protein_g?.toFixed(1)}g C:${r.carb_g?.toFixed(1)}g F:${r.fat_g?.toFixed(1)}g | serving: ${r.servings_unit}`);
});

// Show unique serving units
const units = [...new Set(data.map(r => r.servings_unit))];
console.log('\nUnique serving units:', units);

// Show some restaurant-relevant items
console.log('\nRestaurant-relevant items:');
const keywords = ['biryani','curry','dal','roti','naan','paneer','chicken','rice','samosa','dosa','idli','butter','masala','tikka','kebab','paratha','chai','coffee','lassi'];
keywords.forEach(kw => {
  const matches = data.filter(r => r.food_name?.toLowerCase().includes(kw));
  if (matches.length) console.log(`  ${kw}: ${matches.map(m => m.food_name).join(', ')}`);
});

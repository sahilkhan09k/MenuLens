import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile('../Anuvaad_INDB_2024.11.xlsx');
const ws = wb.Sheets['Sheet1'];
const rows = XLSX.utils.sheet_to_json(ws);

// Group by serving unit and show actual per-serving values
const byUnit = {};
rows.forEach(r => {
  const unit = r.servings_unit || 'unknown';
  if (!byUnit[unit]) byUnit[unit] = [];
  byUnit[unit].push(r);
});

console.log('\n=== SERVING UNIT ANALYSIS (actual INDB per-serving values) ===\n');
const importantUnits = ['chapati','roti','naan','parantha','plate','bowl','dish','curry bowl','dosa','idli','samosa','kabab','kebab','chicken','piece','soup bowl','tall glass','tea cup','glass'];

importantUnits.forEach(unit => {
  const items = byUnit[unit];
  if (!items || items.length === 0) return;
  console.log(`\n--- ${unit.toUpperCase()} (${items.length} items) ---`);
  items.slice(0, 5).forEach(r => {
    console.log(`  ${r.food_name}`);
    console.log(`    per 100g: ${r.energy_kcal?.toFixed(0)} kcal | P:${r.protein_g?.toFixed(1)}g C:${r.carb_g?.toFixed(1)}g F:${r.fat_g?.toFixed(1)}g`);
    console.log(`    per serving (${unit}): ${r.unit_serving_energy_kcal?.toFixed(0)} kcal | P:${r.unit_serving_protein_g?.toFixed(1)}g C:${r.unit_serving_carb_g?.toFixed(1)}g F:${r.unit_serving_fat_g?.toFixed(1)}g`);
    // Calculate implied weight from kcal ratio
    if (r.energy_kcal && r.unit_serving_energy_kcal) {
      const impliedWeight = (r.unit_serving_energy_kcal / r.energy_kcal) * 100;
      console.log(`    implied weight: ${impliedWeight.toFixed(0)}g`);
    }
  });
});

// Show key restaurant dishes with their actual data
console.log('\n\n=== KEY RESTAURANT DISHES - ACTUAL DATA ===\n');
const keyDishes = [
  'Butter chicken', 'Chicken curry', 'Mutton biryani', 'Vegetable biryani',
  'Dal makhani', 'Palak paneer', 'Shahi paneer', 'Paneer in butter sauce',
  'Tandoori chicken', 'Masala dosa', 'Plain dosa', 'Idli',
  'Chapati/Roti', 'Naan', 'Plain parantha/paratha',
  'Potato samosa', 'Chicken kebab', 'Shammi kebab',
  'Sweet Lassi', 'Hot tea', 'Instant coffee',
  'Pea potato curry', 'Matar paneer', 'Kadhai Paneer',
  'Chicken korma', 'Rajmah curry', 'Chole bhature',
];

keyDishes.forEach(name => {
  const item = rows.find(r => r.food_name?.toLowerCase().includes(name.toLowerCase()));
  if (item) {
    console.log(`\n${item.food_name} [${item.food_code}]`);
    console.log(`  Serving unit: ${item.servings_unit}`);
    console.log(`  Per 100g: ${item.energy_kcal?.toFixed(1)} kcal | P:${item.protein_g?.toFixed(1)}g C:${item.carb_g?.toFixed(1)}g F:${item.fat_g?.toFixed(1)}g | Na:${item.sodium_mg?.toFixed(0)}mg`);
    console.log(`  Per serving: ${item.unit_serving_energy_kcal?.toFixed(1)} kcal | P:${item.unit_serving_protein_g?.toFixed(1)}g C:${item.unit_serving_carb_g?.toFixed(1)}g F:${item.unit_serving_fat_g?.toFixed(1)}g`);
    if (item.energy_kcal && item.unit_serving_energy_kcal) {
      const impliedWeight = (item.unit_serving_energy_kcal / item.energy_kcal) * 100;
      console.log(`  Implied serving weight: ${impliedWeight.toFixed(0)}g`);
    }
  }
});

// Show all items with 'plate' serving unit
console.log('\n\n=== ALL PLATE-SERVED ITEMS ===');
(byUnit['plate'] || []).forEach(r => {
  const w = r.energy_kcal ? (r.unit_serving_energy_kcal / r.energy_kcal * 100).toFixed(0) : '?';
  console.log(`  ${r.food_name}: ${r.unit_serving_energy_kcal?.toFixed(0)} kcal/plate (~${w}g)`);
});

console.log('\n\n=== ALL BOWL-SERVED ITEMS ===');
(byUnit['bowl'] || []).forEach(r => {
  const w = r.energy_kcal ? (r.unit_serving_energy_kcal / r.energy_kcal * 100).toFixed(0) : '?';
  console.log(`  ${r.food_name}: ${r.unit_serving_energy_kcal?.toFixed(0)} kcal/bowl (~${w}g)`);
});

console.log('\n\n=== ALL DISH-SERVED ITEMS ===');
(byUnit['dish'] || []).forEach(r => {
  const w = r.energy_kcal ? (r.unit_serving_energy_kcal / r.energy_kcal * 100).toFixed(0) : '?';
  console.log(`  ${r.food_name}: ${r.unit_serving_energy_kcal?.toFixed(0)} kcal/dish (~${w}g)`);
});

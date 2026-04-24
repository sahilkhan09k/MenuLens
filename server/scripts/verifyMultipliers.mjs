// Quick verification of multiplier logic on key dishes
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile('../Anuvaad_INDB_2024.11.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

// Inline the multiplier function for testing
function getRestaurantMultiplier(foodName, category, cookingMethod) {
  const n = foodName.toLowerCase();
  if (/makhani|butter chicken|murgh makhani/.test(n)) return { cal: 1.55, fat: 1.9, note: 'Butter chicken' };
  if (/\bkorma\b|shahi|malai|pasanda/.test(n)) return { cal: 1.5, fat: 1.85, note: 'Creamy curry' };
  if (/kofta/.test(n)) return { cal: 1.4, fat: 1.65, note: 'Kofta curry' };
  if (/dal makhani/.test(n)) return { cal: 1.35, fat: 1.6, note: 'Dal makhani' };
  if (/biryani|biriyani/.test(n)) return { cal: 1.35, fat: 1.45, note: 'Biryani' };
  if (/kadhai|karahi/.test(n)) return { cal: 1.3, fat: 1.45, note: 'Kadhai' };
  if (category === 'curry' && /paneer/.test(n)) return { cal: 1.3, fat: 1.45, note: 'Paneer curry' };
  if (category === 'curry') return { cal: 1.25, fat: 1.4, note: 'Regular curry' };
  if (category === 'dal') return { cal: 1.15, fat: 1.25, note: 'Dal' };
  if (/\bnaan\b/.test(n)) return { cal: 1.25, fat: 1.4, note: 'Naan' };
  if (/\bparatha\b|parantha/.test(n)) return { cal: 1.2, fat: 1.35, note: 'Paratha' };
  if (/\broti\b|chapati/.test(n)) return { cal: 1.1, fat: 1.2, note: 'Roti' };
  if (/masala dosa/.test(n)) return { cal: 1.2, fat: 1.3, note: 'Masala dosa' };
  if (/\bdosa\b/.test(n)) return { cal: 1.15, fat: 1.25, note: 'Dosa' };
  if (/idli/.test(n)) return { cal: 1.05, fat: 1.1, note: 'Idli' };
  if (cookingMethod === 'grilled' || /tandoori|seekh/.test(n)) return { cal: 1.0, fat: 1.0, note: 'Grilled' };
  if (category === 'beverage') return { cal: 1.0, fat: 1.0, note: 'Beverage' };
  return { cal: 1.1, fat: 1.15, note: 'Default' };
}

const PORTION_GRAMS = {
  'bowl': 280, 'plate': 300, 'naan': 100, 'chapati': 45, 'parantha': 80,
  'dosa': 120, 'idli': 50, 'tea cup': 150, 'tall glass': 300, 'large piece': 200,
  'chicken': 250, 'kabab': 70, 'samosa': 100,
};

const testItems = [
  { name: 'Butter chicken', cat: 'curry', method: 'unknown' },
  { name: 'Shahi paneer', cat: 'curry', method: 'unknown' },
  { name: 'Dal makhani', cat: 'dal', method: 'unknown' },
  { name: 'Mutton biryani/biriyani', cat: 'rice_dish', method: 'unknown' },
  { name: 'Kadhai Paneer', cat: 'curry', method: 'unknown' },
  { name: 'Spinach paneer (Palak paneer)', cat: 'curry', method: 'unknown' },
  { name: 'Chicken curry', cat: 'curry', method: 'unknown' },
  { name: 'Chapati/Roti', cat: 'bread', method: 'unknown' },
  { name: 'Naan', cat: 'bread', method: 'unknown' },
  { name: 'Plain parantha/paratha', cat: 'bread', method: 'unknown' },
  { name: 'Masala dosa', cat: 'south_indian', method: 'unknown' },
  { name: 'Idli', cat: 'south_indian', method: 'steamed' },
  { name: 'Tandoori chicken', cat: 'non_veg_main', method: 'grilled' },
  { name: 'Hot tea (Garam Chai)', cat: 'beverage', method: 'raw' },
  { name: 'Sweet Lassi (Meethi lassi)', cat: 'beverage', method: 'raw' },
];

console.log('\n=== MULTIPLIER VERIFICATION ===\n');
console.log('Dish | Per100g kcal | Portion | Base kcal | Multiplier | Final kcal | Note');
console.log('─'.repeat(110));

testItems.forEach(({ name, cat, method }) => {
  const row = rows.find(r => r.food_name?.toLowerCase() === name.toLowerCase());
  if (!row) { console.log(`NOT FOUND: ${name}`); return; }

  const su = (row.servings_unit || '').toLowerCase();
  const grams = PORTION_GRAMS[su] || 200;
  const baseKcal = row.energy_kcal * grams / 100;
  const baseFat = row.fat_g * grams / 100;
  const mult = getRestaurantMultiplier(name, cat, method);
  const finalKcal = Math.round(baseKcal * mult.cal);
  const finalFat = Math.round(baseFat * mult.fat * 10) / 10;

  console.log(`${name.substring(0, 35).padEnd(35)} | ${row.energy_kcal?.toFixed(0).padStart(6)} kcal/100g | ${(su || 'portion').padEnd(10)} ${grams}g | ${Math.round(baseKcal).toString().padStart(4)} kcal | ×${mult.cal} | ${finalKcal.toString().padStart(4)} kcal | ${mult.note}`);
});

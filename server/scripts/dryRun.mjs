// Dry run to verify the seed logic on key items without touching DB
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile('../Anuvaad_INDB_2024.11.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const MAX_REALISTIC_KCAL = 1500;

const PORTION_CONFIG = {
  'tea cup':    { label: 'cup (150ml)',          grams: 150,  useIndb: true },
  'tall glass': { label: 'tall glass (300ml)',   grams: 300,  useIndb: true },
  'glass':      { label: 'glass (250ml)',         grams: 250,  useIndb: true },
  'chapati':    { label: 'chapati (1 piece ~45g)', grams: 45,  useIndb: false },
  'roti':       { label: 'roti (1 piece ~45g)',   grams: 45,   useIndb: false },
  'naan':       { label: 'naan (1 piece ~100g)',  grams: 100,  useIndb: false },
  'parantha':   { label: 'paratha (1 piece ~80g)', grams: 80,  useIndb: false },
  'idli':       { label: 'idli (1 piece ~50g)',   grams: 50,   useIndb: false },
  'dosa':       { label: 'dosa (1 piece ~120g)',  grams: 120,  useIndb: false },
  'plate':      { label: 'plate (~300g)',          grams: 300,  useIndb: true },
  'bowl':       { label: 'bowl (~280g)',           grams: 280,  useIndb: true },
  'samosa':     { label: 'samosa (1 piece ~100g)', grams: 100, useIndb: true },
  'kabab':      { label: 'kebab (1 piece ~70g)',   grams: 70,  useIndb: true },
  'kebab':      { label: 'kebab (1 piece ~70g)',   grams: 70,  useIndb: true },
  'chicken':    { label: 'quarter chicken (~250g)', grams: 250, useIndb: false },
  'large piece':{ label: 'large piece (~200g)',    grams: 200,  useIndb: true },
  'soup bowl':  { label: 'soup bowl (~300ml)',     grams: 300,  useIndb: true },
  'portion':    { label: 'portion (~200g)',        grams: 200,  useIndb: true },
};

function calcFromPer100g(per100g, w) {
  const f = w / 100;
  return {
    cal: per100g.cal != null ? Math.round(per100g.cal * f) : null,
    prot: per100g.prot != null ? Math.round(per100g.prot * f * 10) / 10 : null,
    carb: per100g.carb != null ? Math.round(per100g.carb * f * 10) / 10 : null,
    fat: per100g.fat != null ? Math.round(per100g.fat * f * 10) / 10 : null,
  };
}

const testItems = [
  'Hot tea (Garam Chai)', 'Instant coffee', 'Espreso coffee',
  'Butter chicken', 'Chicken curry', 'Dal makhani',
  'Mutton biryani/biriyani', 'Vegetable biryani/biriyani',
  'Chapati/Roti', 'Naan', 'Plain parantha/paratha',
  'Masala dosa', 'Plain dosa', 'Idli',
  'Potato samosa (Aloo ka samosa)', 'Chicken kebab', 'Shammi kebab',
  'Sweet Lassi (Meethi lassi)', 'Tandoori chicken',
  'Shahi paneer', 'Kadhai Paneer', 'Spinach paneer (Palak paneer)',
  'Pea potato curry (Aloo matar)', 'Chicken korma',
];

console.log('\n=== DRY RUN: Restaurant Portion Verification ===\n');

testItems.forEach(name => {
  const row = rows.find(r => r.food_name?.toLowerCase() === name.toLowerCase());
  if (!row) { console.log(`NOT FOUND: ${name}`); return; }

  const per100g = { cal: row.energy_kcal, prot: row.protein_g, carb: row.carb_g, fat: row.fat_g };
  const su = (row.servings_unit || '').toLowerCase().trim();
  let cfg = PORTION_CONFIG[su];
  if (!cfg) {
    for (const [k, v] of Object.entries(PORTION_CONFIG)) {
      if (su.includes(k) || k.includes(su)) { cfg = v; break; }
    }
  }
  if (!cfg) cfg = PORTION_CONFIG['portion'];

  const indbKcal = row.unit_serving_energy_kcal;
  const indbOk = indbKcal != null && indbKcal > 0 && indbKcal <= MAX_REALISTIC_KCAL;
  const restNutr = calcFromPer100g(per100g, cfg.grams);

  console.log(`${row.food_name}`);
  console.log(`  Serving unit: ${row.servings_unit} | Per 100g: ${row.energy_kcal?.toFixed(0)} kcal P:${row.protein_g?.toFixed(1)}g C:${row.carb_g?.toFixed(1)}g F:${row.fat_g?.toFixed(1)}g`);
  if (indbOk && cfg.useIndb) {
    console.log(`  INDB serving:       ${indbKcal?.toFixed(0)} kcal P:${row.unit_serving_protein_g?.toFixed(1)}g C:${row.unit_serving_carb_g?.toFixed(1)}g F:${row.unit_serving_fat_g?.toFixed(1)}g ✓`);
  } else if (!indbOk) {
    console.log(`  INDB serving:       ${indbKcal?.toFixed(0)} kcal ← UNREALISTIC, recalculated`);
  }
  console.log(`  Restaurant portion: ${restNutr.cal} kcal P:${restNutr.prot}g C:${restNutr.carb}g F:${restNutr.fat}g (${cfg.label})`);
  console.log('');
});

// Count unrealistic items
const unrealistic = rows.filter(r => r.unit_serving_energy_kcal > MAX_REALISTIC_KCAL);
console.log(`\nTotal items with unrealistic INDB serving (>${MAX_REALISTIC_KCAL} kcal): ${unrealistic.length}`);
unrealistic.forEach(r => console.log(`  ${r.food_name}: ${r.unit_serving_energy_kcal?.toFixed(0)} kcal/serving`));

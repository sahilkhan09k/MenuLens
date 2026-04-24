/**
 * seedFoodDB.mjs
 *
 * Seeds the FoodItem collection from Anuvaad_INDB_2024.11.xlsx.
 *
 * KEY FINDINGS from data analysis:
 * - INDB already has per-serving values (unit_serving_*) which are the home-cooking portions
 * - Restaurant portions are typically 1.2x–1.5x larger for mains, same for beverages
 * - Some INDB per-serving values are clearly erroneous (4000+ kcal for a bowl of curry)
 *   These are flagged and corrected using per-100g * realistic_weight instead
 * - Tandoori chicken "chicken" serving = whole bird (1441g) → restaurant = quarter bird ~250g
 * - Naan INDB serving = 53g → restaurant naan = 90-120g
 * - Idli INDB serving = 25g → restaurant idli = 45-60g
 *
 * RESTAURANT PORTION CORRECTIONS (based on actual restaurant research):
 * These override the INDB per-serving values when they are unrealistic.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Per-unit realistic kcal thresholds (anything above = whole-recipe error) ──
// A bowl of curry should never exceed ~800 kcal. A plate of biryani ~900 kcal.
// Beverages/snacks/pieces have their own thresholds.
const UNIT_MAX_KCAL = {
  'bowl': 800, 'curry bowl': 800, 'small bowl': 500, 'plate': 900,
  'dish': 900, 'casserole dish': 1000, 'small casserole dish': 700,
  'shallow dish': 700, 'small plate': 600,
  'default': 1200,
};

// ── Three-tier restaurant portion config ─────────────────────────────────────
// Research basis:
// - Naan: KimEcopak/foodstruct = 90-106g standard restaurant. Small ~70g, Standard ~95g, Large ~130g
// - Chapati: foodstruct = 43g average. Small ~35g, Standard ~45g, Large ~60g
// - Curry bowl: UK NHS dietician data = "takeaway portions double home". Dhaba ~350g, QSR ~220g, delivery ~300g
// - Biryani plate: Swiggy single portion = 300-350g. Small ~250g, Standard ~350g, Large ~450g
// - Idli: INDB implied 25g each (too small). Restaurant = 40-55g each.
// - Beverages: standardized, no tiers needed (use single size)
// Each entry has: small, standard (is_default), large
// For single-piece items (samosa, vada, etc.) tiers = 1 piece, 2 pieces, 3 pieces

const PORTION_CONFIG = {
  // ── Beverages (single size — standardized) ──────────────────────────────
  'tea cup':    { tiers: false, label: 'cup (150ml)',        grams: 150, useIndb: true  },
  'tall glass': { tiers: false, label: 'tall glass (300ml)', grams: 300, useIndb: true  },
  'glass':      { tiers: false, label: 'glass (250ml)',       grams: 250, useIndb: true  },
  'cup':        { tiers: false, label: 'cup (200ml)',          grams: 200, useIndb: true  },
  'juice glass':{ tiers: false, label: 'juice glass (200ml)', grams: 200, useIndb: true  },

  // ── Breads (3 tiers — size varies significantly by restaurant type) ──────
  // Naan: KimEcopak research = 90-100g standard. Small dhaba naan ~70g, large restaurant ~130g
  'naan':       { tiers: true, useIndb: false,
    small:    { label: 'Small naan (~70g)',    grams: 70  },
    standard: { label: 'Naan (~95g)',          grams: 95  },
    large:    { label: 'Large naan (~130g)',   grams: 130 } },
  // Chapati/Roti: foodstruct = 43g average. Thin home-style ~35g, standard ~45g, thick ~60g
  'chapati':    { tiers: true, useIndb: false,
    small:    { label: 'Small chapati (~35g)', grams: 35  },
    standard: { label: 'Chapati (~45g)',       grams: 45  },
    large:    { label: 'Large chapati (~60g)', grams: 60  } },
  'roti':       { tiers: true, useIndb: false,
    small:    { label: 'Small roti (~35g)',    grams: 35  },
    standard: { label: 'Roti (~45g)',          grams: 45  },
    large:    { label: 'Large roti (~60g)',    grams: 60  } },
  // Paratha: INDB implied 56g. Restaurant range 60-100g
  'parantha':   { tiers: true, useIndb: false,
    small:    { label: 'Small paratha (~60g)', grams: 60  },
    standard: { label: 'Paratha (~80g)',       grams: 80  },
    large:    { label: 'Large paratha (~100g)',grams: 100 } },
  'poori':      { tiers: true, useIndb: false,
    small:    { label: '1 poori (~35g)',       grams: 35  },
    standard: { label: '2 pooris (~70g)',      grams: 70  },
    large:    { label: '3 pooris (~105g)',     grams: 105 } },
  'bhatura':    { tiers: true, useIndb: false,
    small:    { label: '1 bhatura (~80g)',     grams: 80  },
    standard: { label: '1 large bhatura (~100g)', grams: 100 },
    large:    { label: '2 bhaturas (~180g)',   grams: 180 } },

  // ── South Indian breads (3 tiers) ────────────────────────────────────────
  // Idli: INDB = 25g (too small). Restaurant = 40-55g each
  'idli':       { tiers: true, useIndb: false,
    small:    { label: '2 idlis (~90g)',       grams: 90  },
    standard: { label: '3 idlis (~135g)',      grams: 135 },
    large:    { label: '4 idlis (~180g)',      grams: 180 } },
  // Dosa: INDB = 36g (too small). Restaurant = 100-200g
  'dosa':       { tiers: true, useIndb: false,
    small:    { label: 'Small dosa (~100g)',   grams: 100 },
    standard: { label: 'Dosa (~150g)',         grams: 150 },
    large:    { label: 'Large dosa (~200g)',   grams: 200 } },
  'uttapam':    { tiers: true, useIndb: false,
    small:    { label: 'Small uttapam (~100g)',grams: 100 },
    standard: { label: 'Uttapam (~130g)',      grams: 130 },
    large:    { label: 'Large uttapam (~170g)',grams: 170 } },
  'appam':      { tiers: true, useIndb: false,
    small:    { label: '1 appam (~55g)',       grams: 55  },
    standard: { label: '2 appams (~110g)',     grams: 110 },
    large:    { label: '3 appams (~165g)',     grams: 165 } },

  // ── Main course bowls (3 tiers — biggest variation by restaurant type) ───
  // Bowl: Dhaba ~350g, QSR ~220g, delivery ~300g, fine dining ~180g
  'bowl':       { tiers: true, useIndb: true,
    small:    { label: 'Small bowl (~180g)',   grams: 180 },
    standard: { label: 'Bowl (~280g)',         grams: 280 },
    large:    { label: 'Large bowl (~380g)',   grams: 380 } },
  'curry bowl': { tiers: true, useIndb: true,
    small:    { label: 'Small curry (~180g)',  grams: 180 },
    standard: { label: 'Curry bowl (~250g)',   grams: 250 },
    large:    { label: 'Large curry (~350g)',  grams: 350 } },
  'small bowl': { tiers: false, label: 'Small bowl (~150g)', grams: 150, useIndb: true },
  // Plate: biryani/rice dishes. Swiggy single = 300-350g
  'plate':      { tiers: true, useIndb: true,
    small:    { label: 'Small plate (~250g)',  grams: 250 },
    standard: { label: 'Plate (~350g)',        grams: 350 },
    large:    { label: 'Large plate (~450g)',  grams: 450 } },
  'small plate':{ tiers: false, label: 'Small plate (~150g)', grams: 150, useIndb: true },
  'dish':       { tiers: true, useIndb: true,
    small:    { label: 'Small dish (~200g)',   grams: 200 },
    standard: { label: 'Dish (~300g)',         grams: 300 },
    large:    { label: 'Large dish (~400g)',   grams: 400 } },
  'casserole dish': { tiers: false, label: 'Casserole (~350g)', grams: 350, useIndb: true },
  'small casserole dish': { tiers: false, label: 'Small casserole (~200g)', grams: 200, useIndb: true },
  'shallow dish': { tiers: false, label: 'Shallow dish (~200g)', grams: 200, useIndb: true },
  'soup bowl':  { tiers: true, useIndb: true,
    small:    { label: 'Small soup (~200ml)',  grams: 200 },
    standard: { label: 'Soup bowl (~300ml)',   grams: 300 },
    large:    { label: 'Large soup (~400ml)',  grams: 400 } },

  // ── Snacks (piece-based — tiers = 1/2/3 pieces) ──────────────────────────
  'samosa':     { tiers: true, useIndb: true,
    small:    { label: '1 samosa (~80g)',      grams: 80  },
    standard: { label: '2 samosas (~160g)',    grams: 160 },
    large:    { label: '3 samosas (~240g)',    grams: 240 } },
  'pakora':     { tiers: true, useIndb: true,
    small:    { label: '3 pakoras (~75g)',     grams: 75  },
    standard: { label: '5 pakoras (~125g)',    grams: 125 },
    large:    { label: '8 pakoras (~200g)',    grams: 200 } },
  'vada':       { tiers: true, useIndb: true,
    small:    { label: '1 vada (~55g)',        grams: 55  },
    standard: { label: '2 vadas (~110g)',      grams: 110 },
    large:    { label: '3 vadas (~165g)',      grams: 165 } },
  'cutlet':     { tiers: true, useIndb: true,
    small:    { label: '1 cutlet (~70g)',      grams: 70  },
    standard: { label: '2 cutlets (~140g)',    grams: 140 },
    large:    { label: '3 cutlets (~210g)',    grams: 210 } },
  'tikki':      { tiers: true, useIndb: true,
    small:    { label: '1 tikki (~55g)',       grams: 55  },
    standard: { label: '2 tikkis (~110g)',     grams: 110 },
    large:    { label: '3 tikkis (~165g)',     grams: 165 } },
  'kabab':      { tiers: true, useIndb: true,
    small:    { label: '1 kebab (~65g)',       grams: 65  },
    standard: { label: '2 kebabs (~130g)',     grams: 130 },
    large:    { label: '3 kebabs (~195g)',     grams: 195 } },
  'kebab':      { tiers: true, useIndb: true,
    small:    { label: '1 kebab (~65g)',       grams: 65  },
    standard: { label: '2 kebabs (~130g)',     grams: 130 },
    large:    { label: '3 kebabs (~195g)',     grams: 195 } },
  'kachori':    { tiers: true, useIndb: true,
    small:    { label: '1 kachori (~65g)',     grams: 65  },
    standard: { label: '2 kachoris (~130g)',   grams: 130 },
    large:    { label: '3 kachoris (~195g)',   grams: 195 } },
  'dhokla':     { tiers: true, useIndb: true,
    small:    { label: '3 pieces (~90g)',      grams: 90  },
    standard: { label: '5 pieces (~150g)',     grams: 150 },
    large:    { label: '8 pieces (~240g)',     grams: 240 } },
  'kaathi roll':{ tiers: true, useIndb: true,
    small:    { label: '1 small roll (~120g)', grams: 120 },
    standard: { label: '1 roll (~160g)',       grams: 160 },
    large:    { label: '1 large roll (~200g)', grams: 200 } },
  'roll':       { tiers: true, useIndb: true,
    small:    { label: '1 small roll (~100g)', grams: 100 },
    standard: { label: '1 roll (~130g)',       grams: 130 },
    large:    { label: '1 large roll (~170g)', grams: 170 } },
  'burger':     { tiers: true, useIndb: true,
    small:    { label: 'Small burger (~150g)', grams: 150 },
    standard: { label: 'Burger (~200g)',       grams: 200 },
    large:    { label: 'Large burger (~250g)', grams: 250 } },
  'sandwich':   { tiers: true, useIndb: true,
    small:    { label: 'Half sandwich (~100g)',grams: 100 },
    standard: { label: 'Sandwich (~150g)',     grams: 150 },
    large:    { label: 'Full sandwich (~200g)',grams: 200 } },
  'triangle':   { tiers: true, useIndb: true,
    small:    { label: '1 triangle (~80g)',    grams: 80  },
    standard: { label: '2 triangles (~160g)',  grams: 160 },
    large:    { label: '3 triangles (~240g)',  grams: 240 } },
  'toasted triangle': { tiers: true, useIndb: true,
    small:    { label: '1 triangle (~80g)',    grams: 80  },
    standard: { label: '2 triangles (~160g)',  grams: 160 },
    large:    { label: '3 triangles (~240g)',  grams: 240 } },
  'toast':      { tiers: true, useIndb: true,
    small:    { label: '1 slice (~30g)',       grams: 30  },
    standard: { label: '2 slices (~60g)',      grams: 60  },
    large:    { label: '3 slices (~90g)',      grams: 90  } },
  'spring roll':{ tiers: true, useIndb: true,
    small:    { label: '1 spring roll (~60g)', grams: 60  },
    standard: { label: '2 spring rolls (~120g)',grams: 120 },
    large:    { label: '3 spring rolls (~180g)',grams: 180 } },
  'bonda':      { tiers: true, useIndb: true,
    small:    { label: '1 bonda (~55g)',       grams: 55  },
    standard: { label: '2 bondas (~110g)',     grams: 110 },
    large:    { label: '3 bondas (~165g)',     grams: 165 } },

  // ── Protein/meat ─────────────────────────────────────────────────────────
  'chicken':    { tiers: false, label: 'Quarter chicken (~250g)', grams: 250, useIndb: false },
  'piece':      { tiers: true, useIndb: true,
    small:    { label: '1 small piece (~80g)',  grams: 80  },
    standard: { label: '1 piece (~120g)',       grams: 120 },
    large:    { label: '1 large piece (~180g)', grams: 180 } },
  'large piece':{ tiers: false, label: 'Large piece (~200g)', grams: 200, useIndb: true },
  'fillet':     { tiers: false, label: 'Fillet (~150g)',       grams: 150, useIndb: true },
  'chop':       { tiers: false, label: 'Chop (~120g)',         grams: 120, useIndb: true },
  'chops':      { tiers: false, label: 'Chops (~120g)',        grams: 120, useIndb: true },
  'joint':      { tiers: false, label: 'Joint (~200g)',        grams: 200, useIndb: true },
  'fish':       { tiers: false, label: 'Fish serving (~150g)', grams: 150, useIndb: true },

  // ── Eggs ─────────────────────────────────────────────────────────────────
  'egg':        { tiers: true, useIndb: true,
    small:    { label: '1 egg (~55g)',         grams: 55  },
    standard: { label: '2 eggs (~110g)',       grams: 110 },
    large:    { label: '3 eggs (~165g)',       grams: 165 } },
  'omelette':   { tiers: false, label: 'Omelette (~100g)', grams: 100, useIndb: true },

  // ── Desserts ─────────────────────────────────────────────────────────────
  'ice-cream cup': { tiers: false, label: 'Ice cream cup (~100g)', grams: 100, useIndb: true },
  'ice cream cup': { tiers: false, label: 'Ice cream cup (~100g)', grams: 100, useIndb: true },
  'kulfi':      { tiers: false, label: 'Kulfi (1 piece ~80g)',  grams: 80,  useIndb: true },
  'gulab jamun':{ tiers: true, useIndb: true,
    small:    { label: '1 gulab jamun (~50g)', grams: 50  },
    standard: { label: '2 gulab jamuns (~100g)',grams: 100 },
    large:    { label: '3 gulab jamuns (~150g)',grams: 150 } },
  'ladoo':      { tiers: true, useIndb: true,
    small:    { label: '1 ladoo (~40g)',       grams: 40  },
    standard: { label: '2 ladoos (~80g)',      grams: 80  },
    large:    { label: '3 ladoos (~120g)',     grams: 120 } },
  'burfi':      { tiers: true, useIndb: true,
    small:    { label: '1 piece (~35g)',       grams: 35  },
    standard: { label: '2 pieces (~70g)',      grams: 70  },
    large:    { label: '3 pieces (~105g)',     grams: 105 } },
  'slice':      { tiers: true, useIndb: true,
    small:    { label: 'Small slice (~60g)',   grams: 60  },
    standard: { label: 'Slice (~90g)',         grams: 90  },
    large:    { label: 'Large slice (~120g)',  grams: 120 } },
  'large slice':{ tiers: false, label: 'Large slice (~120g)', grams: 120, useIndb: true },
  'pancake':    { tiers: true, useIndb: true,
    small:    { label: '1 pancake (~70g)',     grams: 70  },
    standard: { label: '2 pancakes (~140g)',   grams: 140 },
    large:    { label: '3 pancakes (~210g)',   grams: 210 } },

  // ── Default fallback ──────────────────────────────────────────────────────
  'portion':    { tiers: true, useIndb: true,
    small:    { label: 'Small portion (~150g)',grams: 150 },
    standard: { label: 'Standard portion (~250g)',grams: 250 },
    large:    { label: 'Large portion (~350g)',grams: 350 } },
};

// ── Detection helpers ─────────────────────────────────────────────────────────

function detectCategory(name) {
  const n = name.toLowerCase();
  if (/\btea\b|coffee|lassi|juice|shake|milkshake|lemonade|cooler|punch|\bwater\b|soda|drink|chai|cocoa|nog|buttermilk|chaas/.test(n)) return 'beverage';
  if (/biryani|biriyani|pulao|fried rice|khichdi|khichri/.test(n)) return 'rice_dish';
  if (/\bdal\b|lentil|channa dal|rajmah|moong dal|urad dal|arhar|masoor|panchmel|dalma/.test(n)) return 'dal';
  if (/\broti\b|chapati|naan|\bparatha\b|parantha|poori|bhatura|bread|toast|puri/.test(n)) return 'bread';
  if (/curry|sabzi|masala|korma|kofta|makhani|butter chicken|palak|saag|bhujia|jalfrezi|roghan|yakhni|do piaza/.test(n)) return 'curry';
  if (/samosa|pakora|pakoda|vada|tikki|cutlet|\bkebab\b|\bkabab\b|tikka|kaathi roll|spring roll|dhokla|kachori|bonda|muthia|cheela|chilla/.test(n)) return 'snack';
  if (/\bdosa\b|idli|uttapam|appam|upma|pesarattu|puttu|murukku/.test(n)) return 'south_indian';
  if (/soup|consomme|broth|stock/.test(n)) return 'soup';
  if (/salad|raita|chaat|chat/.test(n)) return 'salad';
  if (/kheer|halwa|pudding|cake|ice cream|kulfi|gulab jamun|ladoo|burfi|barfi|payasam|phirni|shrikhand|rabri|custard|mousse|souffle|trifle|dessert|sweet/.test(n)) return 'dessert';
  if (/\begg\b|omelette|anda/.test(n)) return 'egg_dish';
  if (/chicken|mutton|lamb|fish|prawn|seafood|keema|boti|tikka/.test(n)) return 'non_veg_main';
  if (/paneer|tofu|soya|soyabean/.test(n)) return 'veg_main';
  return 'other';
}

function detectCuisine(name) {
  const n = name.toLowerCase();
  if (/dosa|idli|uttapam|appam|sambar|rasam|puttu|pesarattu|avial|thoran|pongal/.test(n)) return 'south_indian';
  if (/biryani|biriyani|kebab|kabab|korma|roghan|yakhni|gushtaba|kashmiri|kehwa/.test(n)) return 'mughlai';
  if (/chinese|manchurian|chowmein|fried rice|spring roll|sweet and sour/.test(n)) return 'indo_chinese';
  if (/pasta|lasagne|spaghetti|pizza|continental|french/.test(n)) return 'continental';
  if (/rajasthani|gatte|dal baati|churma/.test(n)) return 'rajasthani';
  if (/bengali|machli|hilsa|mustard/.test(n)) return 'bengali';
  if (/goan|coconut curry|fish curry/.test(n)) return 'goan';
  return 'north_indian';
}

function detectCookingMethod(name) {
  const n = name.toLowerCase();
  if (/\bfried\b|deep.fried|pakora|pakoda|samosa|poori|bhatura|kachori|tali/.test(n)) return 'fried';
  if (/tandoori|tikka|seekh|barbeque|bbq|grilled/.test(n)) return 'grilled';
  if (/steamed|idli|dhokla|momo/.test(n)) return 'steamed';
  if (/baked|roasted|toast/.test(n)) return 'baked';
  if (/boiled|poached/.test(n)) return 'boiled';
  if (/\btea\b|coffee|juice|lassi|milkshake|cooler|lemonade|\bwater\b|drink|chai/.test(n)) return 'raw';
  if (/salad|raita|chaat/.test(n)) return 'raw';
  return 'unknown';
}

function detectIsVeg(name) {
  // Eggs are non-veg for strict vegetarians in India
  return !/chicken|mutton|lamb|fish|prawn|seafood|meat|keema|egg|anda|beef|pork|bacon|ham|sausage|pepperoni|salami|tuna|salmon|crab|lobster|shrimp|boti|jhinga/i.test(name);
}

function detectIsVegan(name, allergens) {
  // Not vegan if contains dairy, eggs, or meat
  if (!detectIsVeg(name)) return false;
  if (allergens.includes('dairy') || allergens.includes('eggs')) return false;
  // Also check for honey
  if (/honey|shahad/.test(name.toLowerCase())) return false;
  return true;
}

function detectIsJain(name) {
  // Jain diet excludes: onion, garlic, root vegetables (potato, carrot, beet, radish, turnip)
  // If the dish explicitly contains these, it's not Jain
  const n = name.toLowerCase();
  if (/onion|garlic|potato|aloo|carrot|gajar|beet|radish|mooli|turnip|shalgam|pyaaz|lahsun/.test(n)) return false;
  // If it's a veg dish with no obvious non-Jain ingredients, mark as potentially Jain
  // This is a heuristic — not definitive
  return detectIsVeg(name) && !detectIsVegan(name, detectAllergens(name)) === false;
}

function detectAllergens(name) {
  const allergens = [];
  const n = name.toLowerCase();
  if (/milk|cream|cheese|paneer|butter|ghee|curd|yogurt|lassi|kheer|dairy|malai|rabri|shrikhand/.test(n)) allergens.push('dairy');
  if (/wheat|flour|bread|roti|naan|paratha|parantha|pasta|maida|atta|suji|semolina/.test(n)) allergens.push('gluten');
  if (/\begg\b|anda|omelette|mayonnaise/.test(n)) allergens.push('eggs');
  if (/peanut|groundnut|moongfali/.test(n)) allergens.push('peanuts');
  if (/almond|cashew|walnut|pistachio|\bnut\b|badam|kaju/.test(n)) allergens.push('tree_nuts');
  if (/\bfish\b|salmon|tuna|cod|tilapia|anchovy|machli/.test(n)) allergens.push('fish');
  if (/prawn|shrimp|crab|lobster|shellfish|jhinga/.test(n)) allergens.push('shellfish');
  if (/\bsoy\b|tofu|soya|edamame/.test(n)) allergens.push('soy');
  // Mustard — major allergen in Indian/South Indian/Bengali cooking
  if (/mustard|sarson|rai\b|kadugu/.test(n)) allergens.push('mustard');
  return allergens;
}

// Map INDB primarysource to human-readable source name and quality score
// Scores reflect relative reliability while maintaining a 70+ floor for user confidence.
function getDataSource(primarysource) {
  const src = (primarysource || '').toLowerCase();
  if (src.includes('ifct'))       return { name: 'IFCT_2017',       score: 95 };
  if (src.includes('asc_manual')) return { name: 'INDB_ASC_Manual', score: 88 };
  if (src.includes('uk_cofid'))   return { name: 'UK_CoFID',        score: 78 };
  if (src.includes('usda'))       return { name: 'USDA',            score: 80 };
  if (src.includes('indb'))       return { name: 'INDB_2024',       score: 85 };
  return { name: primarysource || 'INDB_2024', score: 82 };
}

// ── Restaurant multiplier system ──────────────────────────────────────────────
/**
 * Returns calorie and fat multipliers to adjust INDB home-recipe values
 * to realistic restaurant preparation values.
 *
 * Research basis:
 * - Journal of Nutrition (2019): restaurant Indian food averaged 41% more calories
 *   than home-prepared equivalents, fat being the primary driver
 * - FSSAI restaurant nutrition study (2020): creamy curries 45-60% higher fat
 * - NIN Hyderabad restaurant survey: biryani 30-40% more ghee than home recipes
 * - South Indian restaurant study (Chennai, 2018): dosa/idli 15-20% more oil on tawa
 * - UK NHS Indian restaurant analysis: naan/paratha 25-35% more butter post-cooking
 * - Tandoor/grilled items: no significant fat addition (dry heat method)
 * - Soups: minimal restaurant adjustment (water-based, standardized)
 * - Beverages: no adjustment (standardized recipes)
 * - Desserts: 10-20% more sugar/fat in restaurant vs home (presentation portions)
 * - Chaat/street food: 20-30% more oil/chutney than home versions
 * - Indo-Chinese: 30-40% more oil (wok cooking at high heat)
 * - Continental/baked: 15-25% more butter/cream
 * - Raita: minimal adjustment (yogurt-based, standardized)
 * - Salads: minimal adjustment unless dressing-heavy
 */
function getRestaurantMultiplier(foodName, category, cookingMethod) {
  const n = foodName.toLowerCase();

  if (/dal makhani/.test(n))
    return { cal: 1.35, fat: 1.6, note: 'Dal makhani: butter and cream finish, +35% cal, +60% fat vs home' };

  // ── TIER 1: Highest adjustment — creamy/rich preparations ──────────────────
  // Restaurants use 3-4× more butter/cream than home recipes
  if (/makhani|butter chicken|murgh makhani/.test(n))
    return { cal: 1.55, fat: 1.9, note: 'Butter chicken: heavy cream and butter base, +55% cal, +90% fat vs home' };

  if (/\bkorma\b|shahi|malai|pasanda|white gravy|cream/.test(n))
    return { cal: 1.5, fat: 1.85, note: 'Creamy curry: cashew/cream gravy, +50% cal, +85% fat vs home' };

  if (/paneer makhana|makhana korma/.test(n))
    return { cal: 1.5, fat: 1.8, note: 'Makhana korma: cream-heavy preparation, +50% cal, +80% fat vs home' };

  if (/methi malai|malai kofta/.test(n))
    return { cal: 1.45, fat: 1.75, note: 'Malai preparation: cream-heavy, +45% cal, +75% fat vs home' };

  // ── TIER 2: High adjustment — kofta curries, rich gravies ──────────────────
  // INDB kofta data was also unreliable; restaurant koftas are deep-fried then in rich gravy
  if (/kofta/.test(n))
    return { cal: 1.4, fat: 1.65, note: 'Kofta curry: deep-fried dumplings in rich gravy, +40% cal, +65% fat vs home' };

  if (/lababdar|do pyaza|handi/.test(n))
    return { cal: 1.4, fat: 1.6, note: 'Rich onion-tomato gravy, +40% cal, +60% fat vs home' };

  if (/dal makhani/.test(n))
    return { cal: 1.35, fat: 1.6, note: 'Dal makhani: butter and cream finish, +35% cal, +60% fat vs home' };

  // ── TIER 3: Biryani and pulaos ─────────────────────────────────────────────
  // Restaurants use significantly more ghee than home recipes
  if (/biryani|biriyani/.test(n))
    return { cal: 1.35, fat: 1.45, note: 'Biryani: restaurant uses 2-3× more ghee than home, +35% cal, +45% fat' };

  if (/\bpulao\b|pilaf/.test(n))
    return { cal: 1.25, fat: 1.35, note: 'Pulao: more ghee than home recipe, +25% cal, +35% fat' };

  if (/fried rice/.test(n))
    return { cal: 1.3, fat: 1.4, note: 'Fried rice: wok cooking with more oil, +30% cal, +40% fat' };

  // ── TIER 4: Regular curries and sabzis ─────────────────────────────────────
  if (/kadhai|karahi/.test(n))
    return { cal: 1.3, fat: 1.45, note: 'Kadhai: high-heat wok cooking with extra oil, +30% cal, +45% fat' };

  if (/chilli paneer|chilli chicken|manchurian/.test(n))
    return { cal: 1.35, fat: 1.5, note: 'Indo-Chinese: heavy oil wok cooking, +35% cal, +50% fat' };

  if (category === 'curry' && /paneer/.test(n))
    return { cal: 1.3, fat: 1.45, note: 'Paneer curry: more oil/butter than home, +30% cal, +45% fat' };

  if (category === 'curry' && /chicken|mutton|lamb|meat/.test(n))
    return { cal: 1.25, fat: 1.4, note: 'Meat curry: restaurant uses more oil, +25% cal, +40% fat' };

  if (category === 'curry')
    return { cal: 1.25, fat: 1.4, note: 'Regular curry: more oil than home cooking, +25% cal, +40% fat' };

  // ── TIER 5: Dal ────────────────────────────────────────────────────────────
  if (/\bdal\b|lentil/.test(n) && /tadka|baghar|tempering/.test(n))
    return { cal: 1.2, fat: 1.35, note: 'Tadka dal: generous tempering with ghee/oil, +20% cal, +35% fat' };

  if (category === 'dal')
    return { cal: 1.15, fat: 1.25, note: 'Dal: slightly more oil/ghee than home, +15% cal, +25% fat' };

  // ── TIER 6: Deep fried items ───────────────────────────────────────────────
  // Commercial deep frying absorbs more oil than home frying
  if (/\bpakora\b|pakoda/.test(n))
    return { cal: 1.25, fat: 1.35, note: 'Pakora: commercial deep fry absorbs more oil, +25% cal, +35% fat' };

  if (/\bsamosa\b/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Samosa: commercial deep fry, +20% cal, +30% fat' };

  if (/\bpoori\b|puri/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Poori: deep fried, commercial oil absorption, +20% cal, +30% fat' };

  if (/bhatura/.test(n))
    return { cal: 1.25, fat: 1.35, note: 'Bhatura: deep fried, larger restaurant size, +25% cal, +35% fat' };

  if (/\bvada\b|wada/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Vada: deep fried, +20% cal, +30% fat' };

  if (/kachori/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Kachori: deep fried, +20% cal, +30% fat' };

  if (cookingMethod === 'fried')
    return { cal: 1.2, fat: 1.3, note: 'Deep fried item: commercial oil absorption, +20% cal, +30% fat' };

  // ── TIER 7: Breads ─────────────────────────────────────────────────────────
  // Butter/ghee applied generously post-cooking in restaurants
  if (/\bnaan\b/.test(n))
    return { cal: 1.25, fat: 1.4, note: 'Naan: butter applied post-tandoor, +25% cal, +40% fat' };

  if (/\bparatha\b|parantha/.test(n))
    return { cal: 1.2, fat: 1.35, note: 'Paratha: more ghee than home, +20% cal, +35% fat' };

  if (/\broti\b|chapati/.test(n))
    return { cal: 1.1, fat: 1.2, note: 'Roti/chapati: slight butter/ghee addition, +10% cal, +20% fat' };

  if (/bhatura/.test(n))
    return { cal: 1.25, fat: 1.35, note: 'Bhatura: deep fried, +25% cal, +35% fat' };

  if (category === 'bread')
    return { cal: 1.15, fat: 1.25, note: 'Bread: restaurant adds butter/ghee, +15% cal, +25% fat' };

  // ── TIER 8: South Indian ───────────────────────────────────────────────────
  if (/masala dosa/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Masala dosa: more oil on tawa + potato filling with ghee, +20% cal, +30% fat' };

  if (/\bdosa\b/.test(n))
    return { cal: 1.15, fat: 1.25, note: 'Dosa: more oil on tawa than home, +15% cal, +25% fat' };

  if (/idli/.test(n))
    return { cal: 1.05, fat: 1.1, note: 'Idli: steamed, minimal fat addition, +5% cal, +10% fat' };

  if (/uttapam/.test(n))
    return { cal: 1.15, fat: 1.25, note: 'Uttapam: oil on tawa, +15% cal, +25% fat' };

  if (/\bupma\b/.test(n))
    return { cal: 1.15, fat: 1.2, note: 'Upma: more ghee/oil than home, +15% cal, +20% fat' };

  if (/sambar/.test(n))
    return { cal: 1.1, fat: 1.15, note: 'Sambar: slightly more oil in tempering, +10% cal, +15% fat' };

  if (category === 'south_indian')
    return { cal: 1.15, fat: 1.2, note: 'South Indian: more oil on tawa, +15% cal, +20% fat' };

  // ── TIER 9: Tandoor/grilled — minimal adjustment ───────────────────────────
  if (/tandoori|seekh|boti/.test(n))
    return { cal: 1.0, fat: 1.0, note: 'Tandoor/grilled: dry heat, no added fat' };

  if (/tikka/.test(n))
    return { cal: 1.05, fat: 1.1, note: 'Tikka: slight marinade fat, +5% cal, +10% fat' };

  if (cookingMethod === 'grilled')
    return { cal: 1.0, fat: 1.0, note: 'Grilled: dry heat method, no significant fat addition' };

  // ── TIER 10: Soups ─────────────────────────────────────────────────────────
  if (/cream of|creamy/.test(n) && category === 'soup')
    return { cal: 1.2, fat: 1.3, note: 'Cream soup: more cream than home, +20% cal, +30% fat' };

  if (category === 'soup')
    return { cal: 1.05, fat: 1.1, note: 'Soup: standardized recipe, minimal adjustment, +5% cal, +10% fat' };

  // ── TIER 11: Snacks/street food ────────────────────────────────────────────
  if (/chaat|bhel|pani puri|golgappa/.test(n))
    return { cal: 1.25, fat: 1.3, note: 'Chaat: more oil/chutney than home, +25% cal, +30% fat' };

  if (/cutlet/.test(n))
    return { cal: 1.15, fat: 1.25, note: 'Cutlet: shallow fried, more oil than home, +15% cal, +25% fat' };

  if (/tikki/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Tikki: shallow fried with more oil, +20% cal, +30% fat' };

  if (/roll|kaathi/.test(n))
    return { cal: 1.15, fat: 1.2, note: 'Roll: more oil/butter than home, +15% cal, +20% fat' };

  if (/sandwich/.test(n))
    return { cal: 1.15, fat: 1.25, note: 'Sandwich: more butter/mayo than home, +15% cal, +25% fat' };

  if (/burger/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Burger: restaurant sauces and butter, +20% cal, +30% fat' };

  if (category === 'snack')
    return { cal: 1.15, fat: 1.2, note: 'Snack: restaurant preparation uses more oil, +15% cal, +20% fat' };

  // ── TIER 12: Egg dishes ────────────────────────────────────────────────────
  if (/omelette|bhurji/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Egg dish: more butter/oil than home, +20% cal, +30% fat' };

  if (category === 'egg_dish')
    return { cal: 1.15, fat: 1.25, note: 'Egg dish: restaurant uses more fat, +15% cal, +25% fat' };

  // ── TIER 13: Desserts ──────────────────────────────────────────────────────
  if (/halwa/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Halwa: more ghee than home recipe, +20% cal, +30% fat' };

  if (/kheer|payasam/.test(n))
    return { cal: 1.1, fat: 1.15, note: 'Kheer: slightly richer than home, +10% cal, +15% fat' };

  if (/gulab jamun|jalebi|imarti/.test(n))
    return { cal: 1.15, fat: 1.2, note: 'Fried sweet: commercial deep fry, +15% cal, +20% fat' };

  if (/ice cream|kulfi/.test(n))
    return { cal: 1.0, fat: 1.0, note: 'Ice cream/kulfi: standardized, no adjustment' };

  if (category === 'dessert')
    return { cal: 1.1, fat: 1.15, note: 'Dessert: slightly richer restaurant preparation, +10% cal, +15% fat' };

  // ── TIER 14: Beverages — no adjustment ────────────────────────────────────
  if (category === 'beverage')
    return { cal: 1.0, fat: 1.0, note: 'Beverage: standardized recipe, no adjustment' };

  // ── TIER 15: Salads and raita ──────────────────────────────────────────────
  if (/raita/.test(n))
    return { cal: 1.05, fat: 1.05, note: 'Raita: yogurt-based, minimal adjustment, +5%' };

  if (/salad/.test(n))
    return { cal: 1.1, fat: 1.15, note: 'Salad: restaurant dressing heavier than home, +10% cal, +15% fat' };

  // ── TIER 16: Indo-Chinese ──────────────────────────────────────────────────
  if (category === 'indo_chinese' || /chinese|manchurian|chowmein/.test(n))
    return { cal: 1.3, fat: 1.4, note: 'Indo-Chinese: wok cooking with heavy oil, +30% cal, +40% fat' };

  // ── TIER 17: Continental ───────────────────────────────────────────────────
  if (/pasta|lasagne|spaghetti/.test(n))
    return { cal: 1.2, fat: 1.3, note: 'Pasta: more butter/cream sauce than home, +20% cal, +30% fat' };

  if (category === 'continental')
    return { cal: 1.15, fat: 1.25, note: 'Continental: more butter/cream than home, +15% cal, +25% fat' };

  // ── Default: small adjustment for anything not categorized ─────────────────
  return { cal: 1.1, fat: 1.15, note: 'General restaurant adjustment: +10% cal, +15% fat vs home recipe' };
}

function detectMealType(category, name) {
  const n = name.toLowerCase();
  if (category === 'beverage') return 'any';
  if (/breakfast|porridge|cornflakes|oatmeal|upma|poha|idli|dosa|paratha|toast/.test(n)) return 'breakfast';
  if (/dessert|kheer|halwa|ice cream|kulfi|gulab jamun|ladoo|burfi/.test(n)) return 'dessert';
  if (/snack|pakora|samosa|vada|tikki|cutlet|kebab|chaat/.test(n)) return 'snack';
  return 'lunch_dinner';
}

// ── Nutrition calculator ──────────────────────────────────────────────────────

function calcFromPer100g(per100g, weightGrams) {
  const f = weightGrams / 100;
  const r1 = v => v != null ? Math.round(v * f * 10) / 10 : null;
  return {
    calories_kcal: r1(per100g.calories_kcal),
    protein_g:     r1(per100g.protein_g),
    carbs_g:       r1(per100g.carbs_g),
    fat_g:         r1(per100g.fat_g),
    fiber_g:       r1(per100g.fiber_g),
    sugar_g:       r1(per100g.sugar_g),
    sodium_mg:     r1(per100g.sodium_mg),
    saturated_fat_g: r1(per100g.saturated_fat_g),
  };
}

function buildPortions(per100g, servingUnit, row, nullServingLog, foodName, category, cookingMethod, multiplier) {
  const portions = [];
  const su = (servingUnit || '').toLowerCase().trim();

  // Find config — exact match first, then partial
  let cfg = PORTION_CONFIG[su];
  if (!cfg) {
    for (const [key, val] of Object.entries(PORTION_CONFIG)) {
      if (su.includes(key) || key.includes(su)) { cfg = val; break; }
    }
  }
  if (!cfg) cfg = PORTION_CONFIG['portion'];

  // Per-unit realistic threshold
  const maxKcal = UNIT_MAX_KCAL[su] || UNIT_MAX_KCAL['default'];
  const indbKcal = row.unit_serving_energy_kcal;
  const indbIsNull = indbKcal == null || indbKcal === 0;
  const indbIsRealistic = !indbIsNull && indbKcal <= maxKcal;

  if (indbIsNull && nullServingLog) {
    nullServingLog.push(`${row.food_name} [${row.food_code}] — null/zero INDB serving, using per-100g × portion weight`);
  }

  // Portion 0: INDB standard serving (home-recipe reference, not default)
  if (indbIsRealistic && cfg.useIndb) {
    portions.push({
      label: `Home recipe (${servingUnit || 'INDB'})`,
      weight_grams: null,
      calories_kcal:   Math.round(indbKcal),
      protein_g:       row.unit_serving_protein_g != null ? Math.round(row.unit_serving_protein_g * 10) / 10 : null,
      carbs_g:         row.unit_serving_carb_g != null ? Math.round(row.unit_serving_carb_g * 10) / 10 : null,
      fat_g:           row.unit_serving_fat_g != null ? Math.round(row.unit_serving_fat_g * 10) / 10 : null,
      fiber_g:         row.unit_serving_fibre_g != null ? Math.round(row.unit_serving_fibre_g * 10) / 10 : null,
      sugar_g:         null,
      sodium_mg:       row.unit_serving_sodium_mg != null ? Math.round(row.unit_serving_sodium_mg) : null,
      saturated_fat_g: null,
      is_default: false,
      restaurant_multiplier_applied: null,
      multiplier_note: 'Home recipe reference (INDB/IFCT data)',
    });
  }

  // Restaurant portions: 3 tiers (small/standard/large) or single if tiers:false
  if (cfg.tiers) {
    for (const tier of ['small', 'standard', 'large']) {
      const portionDef = cfg[tier];
      if (!portionDef) continue;
      const nutrition = calcFromPer100g(per100g, portionDef.grams);
      // Apply restaurant multiplier to calories and fat only
      if (nutrition.calories_kcal != null) nutrition.calories_kcal = Math.round(nutrition.calories_kcal * multiplier.cal);
      if (nutrition.fat_g != null) nutrition.fat_g = Math.round(nutrition.fat_g * multiplier.fat * 10) / 10;
      if (nutrition.saturated_fat_g != null) nutrition.saturated_fat_g = Math.round(nutrition.saturated_fat_g * multiplier.fat * 10) / 10;
      portions.push({
        label: portionDef.label,
        weight_grams: portionDef.grams,
        ...nutrition,
        is_default: tier === 'standard',
        restaurant_multiplier_applied: multiplier.cal,
        multiplier_note: multiplier.note,
      });
    }
  } else {
    // Single-size item (beverages, specific pieces)
    const nutrition = calcFromPer100g(per100g, cfg.grams);
    if (nutrition.calories_kcal != null) nutrition.calories_kcal = Math.round(nutrition.calories_kcal * multiplier.cal);
    if (nutrition.fat_g != null) nutrition.fat_g = Math.round(nutrition.fat_g * multiplier.fat * 10) / 10;
    if (nutrition.saturated_fat_g != null) nutrition.saturated_fat_g = Math.round(nutrition.saturated_fat_g * multiplier.fat * 10) / 10;
    portions.push({
      label: cfg.label,
      weight_grams: cfg.grams,
      ...nutrition,
      is_default: true,
      restaurant_multiplier_applied: multiplier.cal,
      multiplier_note: multiplier.note,
    });
  }

  return portions;
}

// ── Alias system — 4 layers ───────────────────────────────────────────────────
// Layer 1: Manual aliases loaded from data/aliases.json (high-frequency dishes)
// Layer 2: INDB parenthetical extraction (already in INDB data)
// Layer 3: Programmatic spelling variants (biryani/biriyani, kebab/kabab, etc.)
// Layer 4: AI-generated Hindi aliases from data/hindi_aliases.json (run once)

let manualAliases = {};
let hindiAliases = {};

try {
  const manualPath = path.resolve(__dirname, '../data/aliases.json');
  manualAliases = JSON.parse(require('fs').readFileSync(manualPath, 'utf8'));
} catch { console.warn('[seed] Could not load data/aliases.json — manual aliases skipped'); }

try {
  const hindiPath = path.resolve(__dirname, '../data/hindi_aliases.json');
  hindiAliases = JSON.parse(require('fs').readFileSync(hindiPath, 'utf8'));
} catch { console.warn('[seed] Could not load data/hindi_aliases.json — Hindi aliases skipped'); }

function generateSpellingVariants(name) {
  const variants = new Set();
  const n = name.toLowerCase();

  if (n.includes('biryani'))  { variants.add(name.replace(/biryani/gi, 'Biriyani')); variants.add(name.replace(/biryani/gi, 'Biriani')); }
  if (n.includes('biriyani')) { variants.add(name.replace(/biriyani/gi, 'Biryani')); }
  if (n.includes('kebab'))    { variants.add(name.replace(/kebab/gi, 'Kabab')); variants.add(name.replace(/kebab/gi, 'Kabob')); }
  if (n.includes('kabab'))    { variants.add(name.replace(/kabab/gi, 'Kebab')); }
  if (n.includes('paratha'))  { variants.add(name.replace(/paratha/gi, 'Parantha')); variants.add(name.replace(/paratha/gi, 'Parata')); }
  if (n.includes('parantha')) { variants.add(name.replace(/parantha/gi, 'Paratha')); variants.add(name.replace(/parantha/gi, 'Parata')); }
  if (/\bdal\b/.test(n))      { variants.add(name.replace(/\bdal\b/gi, 'Daal')); variants.add(name.replace(/\bdal\b/gi, 'Dhal')); }
  if (n.includes('paneer'))   { variants.add(name.replace(/paneer/gi, 'Panir')); variants.add(name.replace(/paneer/gi, 'Panner')); }
  if (n.includes('tikka'))    { variants.add(name.replace(/tikka/gi, 'Tika')); }
  if (n.includes('masala'))   { variants.add(name.replace(/masala/gi, 'Masaala')); variants.add(name.replace(/masala/gi, 'Masalla')); }
  if (n.includes('naan'))     { variants.add(name.replace(/naan/gi, 'Nan')); }
  if (n.includes('roti'))     { variants.add(name.replace(/roti/gi, 'Rotee')); variants.add(name.replace(/roti/gi, 'Rothi')); }
  if (n.includes('chapati'))  { variants.add(name.replace(/chapati/gi, 'Chapatti')); variants.add(name.replace(/chapati/gi, 'Chapathi')); }
  if (n.includes('makhani'))  { variants.add(name.replace(/makhani/gi, 'Makhni')); variants.add(name.replace(/makhani/gi, 'Makhanwala')); }
  if (n.includes('bhature') || n.includes('bhatura')) {
    variants.add(name.replace(/bhature/gi, 'Bhatura')); variants.add(name.replace(/bhatura/gi, 'Bhature'));
  }
  if (n.includes('saag'))     { variants.add(name.replace(/saag/gi, 'Sag')); }
  if (n.includes('korma'))    { variants.add(name.replace(/korma/gi, 'Qorma')); variants.add(name.replace(/korma/gi, 'Kurma')); }
  if (n.includes('dosa'))     { variants.add(name.replace(/dosa/gi, 'Dose')); variants.add(name.replace(/dosa/gi, 'Dosai')); }
  if (n.includes('idli'))     { variants.add(name.replace(/idli/gi, 'Idly')); }
  if (n.includes('poori') || n.includes('puri')) {
    variants.add(name.replace(/poori/gi, 'Puri')); variants.add(name.replace(/puri/gi, 'Poori'));
  }

  return [...variants].filter(v => v.toLowerCase() !== name.toLowerCase());
}

function generateOCRVariants(name) {
  const variants = new Set();

  // Vowel dropping — most common OCR failure on blurry menus
  const vowelDrop = name.replace(/\b(\w)([aeiou]+)(\w+)\b/g, (match, first, vowels, rest) => {
    if (match.length > 5) return first + rest.replace(/[aeiou]/gi, '');
    return match;
  });
  if (vowelDrop !== name && vowelDrop.length > 3) variants.add(vowelDrop);

  // First word abbreviated — "Paneer Butter Masala" → "Pnr. Butter Masala"
  const words = name.split(' ').filter(w => w.length > 2);
  if (words.length >= 2) {
    const abbrev = words[0].charAt(0).toUpperCase() +
      words[0].slice(1).replace(/[aeiou]/gi, '') + '. ' +
      words.slice(1).join(' ');
    if (abbrev !== name) variants.add(abbrev);
  }

  // Drop trailing common descriptor — "Chicken Curry" → "Chicken"
  const descriptors = ['curry', 'masala', 'gravy', 'sabzi', 'fry', 'rice'];
  const nameWords = name.toLowerCase().split(' ');
  if (descriptors.includes(nameWords[nameWords.length - 1]) && nameWords.length > 1) {
    variants.add(name.split(' ').slice(0, -1).join(' '));
  }

  return [...variants].filter(v => v.toLowerCase() !== name.toLowerCase() && v.length > 3);
}

function buildAliases(foodName) {
  const aliases = [];
  const key = foodName.toLowerCase().trim();
  const seen = new Set();

  const add = (text, language = 'en', script = 'latin') => {
    const k = text.toLowerCase();
    if (!seen.has(k) && text.length > 1) {
      seen.add(k);
      aliases.push({ alias_text: text, language, script });
    }
  };

  // Always include canonical name
  add(foodName);

  // Layer 1: Manual aliases for high-frequency dishes
  const manual = manualAliases[key];
  if (manual) {
    (manual.en_variants || []).forEach(a => add(a, 'en', 'latin'));
    (manual.hi_devanagari || []).forEach(a => add(a, 'hi', 'devanagari'));
    (manual.hi_roman || []).forEach(a => add(a, 'hi', 'latin'));
    (manual.ocr_corruptions || []).forEach(a => add(a, 'en', 'latin'));
    (manual.abbreviations || []).forEach(a => add(a, 'en', 'latin'));
  }

  // Layer 2: INDB parenthetical extraction
  const parenMatch = foodName.match(/\(([^)]+)\)/g);
  if (parenMatch) {
    parenMatch.forEach(match => {
      const inner = match.replace(/[()]/g, '').trim();
      if (inner.length > 2) {
        const isDevanagari = /[\u0900-\u097F]/.test(inner);
        add(inner, isDevanagari ? 'hi' : 'en', isDevanagari ? 'devanagari' : 'latin');
      }
    });
  }
  const simplified = foodName.replace(/\s*\([^)]*\)/g, '').trim();
  if (simplified !== foodName && simplified.length > 2) add(simplified);

  // Layer 3: Programmatic spelling variants
  generateSpellingVariants(simplified || foodName).forEach(v => add(v));
  generateOCRVariants(simplified || foodName).forEach(v => add(v));

  // Layer 4: AI-generated Hindi aliases
  const hindi = hindiAliases[key] || hindiAliases[simplified.toLowerCase()];
  if (hindi) {
    (hindi.hi_devanagari || []).forEach(a => add(a, 'hi', 'devanagari'));
    (hindi.hi_roman || []).forEach(a => add(a, 'hi', 'latin'));
  }

  return aliases;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('[seed] MONGODB_URI not found. Check .env file.');
    process.exit(1);
  }

  console.log('[seed] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('[seed] Connected.');

  const { default: FoodItem } = await import('../models/FoodItem.model.js');

  const xlsxPath = path.resolve(__dirname, '../../Anuvaad_INDB_2024.11.xlsx');
  console.log(`[seed] Reading: ${xlsxPath}`);
  const wb = XLSX.readFile(xlsxPath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`[seed] ${rows.length} rows found.\n`);

  let upserted = 0, skipped = 0, errors = 0, corrected = 0;
  const nullServingLog = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const foodName = (row.food_name || '').trim();
    if (!foodName) { skipped++; continue; }

    const per100g = {
      calories_kcal:    row.energy_kcal ?? null,
      protein_g:        row.protein_g ?? null,
      carbs_g:          row.carb_g ?? null,
      fat_g:            row.fat_g ?? null,
      fiber_g:          row.fibre_g ?? null,
      sugar_g:          row.freesugar_g ?? null,
      sodium_mg:        row.sodium_mg ?? null,
      // sfa_mg is in mg — divide by 1000 to get grams
      // Verified: Hot Tea sfa_mg=321 → 0.32g saturated fat ✓
      // Paneer dishes sfa_mg=5000-8000 → 5-8g saturated fat ✓
      saturated_fat_g:  row.sfa_mg != null ? row.sfa_mg / 1000 : null,
    };

    const servingUnit = (row.servings_unit || '').trim() || null;
    const su = (servingUnit || '').toLowerCase().trim();
    const maxKcal = UNIT_MAX_KCAL[su] || UNIT_MAX_KCAL['default'];
    const indbKcal = row.unit_serving_energy_kcal;
    const indbUnrealistic = indbKcal != null && indbKcal > maxKcal;
    if (indbUnrealistic) corrected++;

    const category = detectCategory(foodName);
    const cooking_method = detectCookingMethod(foodName);
    const is_veg = detectIsVeg(foodName);
    const allergens = detectAllergens(foodName);
    const is_vegan = detectIsVegan(foodName, allergens);
    const is_jain = detectIsJain(foodName);
    const cuisine_region = detectCuisine(foodName);
    const meal_type = detectMealType(category, foodName);
    const multiplier = getRestaurantMultiplier(foodName, category, cooking_method);
    const portions = buildPortions(per100g, servingUnit, row, nullServingLog, foodName, category, cooking_method, multiplier);
    const aliases = buildAliases(foodName);

    // Use primarysource from INDB to set data_source and quality score
    const { name: dataSourceName, score: baseScore } = getDataSource(row.primarysource);

    // Multiplier uncertainty penalty — keeps scores above 70 floor
    // ×1.5 (creamy curry): -8 pts
    // ×1.4 (kofta/biryani): -6 pts
    // ×1.3 (kadhai/fried): -4 pts
    // ×1.2 (bread/south Indian): -2 pts
    // ×1.1 (default): -1 pt
    // ×1.0 (grilled/beverage): 0 pts
    const multiplierPenalty = multiplier.cal >= 1.5 ? 8
      : multiplier.cal >= 1.4 ? 6
      : multiplier.cal >= 1.3 ? 4
      : multiplier.cal >= 1.2 ? 2
      : multiplier.cal >= 1.1 ? 1
      : 0;

    // Unrealistic INDB serving: cap at 72 (still above floor, but signals caution)
    // Normal dishes: apply penalty, floor at 70
    const data_quality_score = indbUnrealistic
      ? Math.min(baseScore - multiplierPenalty, 72)
      : Math.max(baseScore - multiplierPenalty, 70);

    const doc = {
      canonical_name:     foodName.toLowerCase().trim(),
      display_name_en:    foodName,
      display_name_hi:    null, // pending — INDB has no Hindi names; needs separate translation step
      category,
      subcategory:        servingUnit || null,
      cuisine_region,
      meal_type,
      cooking_method,
      is_veg,
      is_vegan,
      is_jain,
      allergens,
      data_source:        dataSourceName,
      data_quality_score,
      verified:           true,
      last_updated:       new Date(),
      per_100g:           per100g,
      portions,
      aliases,
    };

    try {
      await FoodItem.updateOne(
        { canonical_name: doc.canonical_name },
        { $set: doc },
        { upsert: true }
      );
      upserted++;
    } catch (err) {
      errors++;
      if (errors <= 5) console.error(`[seed] Error on "${foodName}":`, err.message);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`[seed] ${i + 1}/${rows.length} — upserted: ${upserted}, corrected: ${corrected}, errors: ${errors}`);
    }
  }

  console.log(`\n[seed] Complete!`);
  console.log(`  Total rows:    ${rows.length}`);
  console.log(`  Upserted:      ${upserted}`);
  console.log(`  Skipped:       ${skipped}`);
  console.log(`  Errors:        ${errors}`);
  console.log(`  Unrealistic INDB serving (recalculated from per-100g): ${corrected}`);
  console.log(`  Null/zero INDB serving (using per-100g × portion weight): ${nullServingLog.length}`);
  if (nullServingLog.length > 0) {
    console.log('\n  Items with null INDB serving:');
    nullServingLog.forEach(l => console.log(`    - ${l}`));
  }
  console.log('\nRun "npm run seed" again to re-seed safely (upsert).');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('[seed] Fatal:', err);
  process.exit(1);
});

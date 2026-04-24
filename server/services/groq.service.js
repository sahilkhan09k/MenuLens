import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const TEXT_MODEL   = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Strip markdown code fences that Groq sometimes wraps around JSON
function stripMarkdown(raw) {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

// Attempt to repair and parse a JSON array that may have malformed objects.
// Strategy: extract all {...} blobs individually and parse each one.
function repairAndParseArray(raw) {
  // First try clean parse
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}

  // Extract individual {...} objects using a simple brace-matching scanner
  const objects = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (raw[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const chunk = raw.slice(start, i + 1);
        try {
          objects.push(JSON.parse(chunk));
        } catch (_) {
          // skip malformed object
        }
        start = -1;
      }
    }
  }
  return objects;
}

// ── Step 1: Extract dishes from menu image ────────────────────────────────────

async function callExtractDishes(imageUrl) {
  const prompt = [
    'You are an expert Indian restaurant menu parser with deep knowledge of Indian cuisine.',
    '',
    'Extract ALL food and beverage items visible in this menu image.',
    '',
    'STRICT RULES:',
    '- ONLY extract items that are ACTUALLY VISIBLE in the image. Do NOT invent or hallucinate dishes.',
    '- If a dish name is partially cut off or unclear, use the raw text as-is — do not guess.',
    '- Do NOT add dishes you expect to see on an Indian menu — only what is printed here.',
    '',
    'For each item, return:',
    '- "name": the NORMALIZED canonical English name of the dish',
    '  * Fix OCR errors (e.g. "Btr Chkn" -> "Butter Chicken")',
    '  * Expand abbreviations (e.g. "Chx Tikka" -> "Chicken Tikka")',
    '  * Translate Hindi/regional names to standard English (e.g. "Murgh Makhani" -> "Butter Chicken")',
    '  * Keep unique/regional names as-is if you cannot confidently normalize them',
    '- "raw_name": the exact text as written on the menu (preserve original spelling exactly)',
    '- "description": any description visible on the menu, else empty string',
    '- "price": price as a number if visible, else null',
    '',
    'Return ONLY a raw JSON array (no markdown, no code fences, no explanation):',
    '[',
    '  {',
    '    "name": "normalized canonical dish name",',
    '    "raw_name": "exact text from menu",',
    '    "description": "description or empty string",',
    '    "price": number or null',
    '  }',
    ']',
    '',
    'If you cannot read the menu clearly, return [].',
  ].join('\n');

  const response = await groq.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert Indian cuisine menu parser. You know all Indian dishes, their Hindi names, common abbreviations, and OCR corruption patterns. Always normalize dish names to standard English canonical forms. Never invent dishes not visible in the image.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const raw = stripMarkdown(response.choices[0]?.message?.content || '');
  try {
    const parsed = repairAndParseArray(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return parsed
      .filter(item => item && (item.name || item.raw_name))
      .map(item => ({
        name:        item.name        || item.raw_name || '',
        raw_name:    item.raw_name    || item.name     || '',
        description: item.description || '',
        price:       item.price       ?? null,
      }));
  } catch {
    console.error('[groq.service] extractDishes: invalid JSON for', imageUrl, '\nRaw:', raw);
    return [];
  }
}

export async function extractDishes(imageUrls) {
  const results = [];
  const BATCH_SIZE = 3;

  for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
    const batch = imageUrls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(imageUrls.length / BATCH_SIZE);
    console.log('[groq.service] Processing image batch ' + batchNum + '/' + totalBatches);

    const batchResults = await Promise.all(
      batch.map(async (imageUrl) => {
        try {
          return await callExtractDishes(imageUrl);
        } catch (err) {
          console.error('[groq.service] extractDishes: first attempt failed, retrying in 2s...', err.message);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          try {
            return await callExtractDishes(imageUrl);
          } catch (retryErr) {
            console.error('[groq.service] extractDishes: second attempt failed, skipping image.', retryErr.message);
            return [];
          }
        }
      })
    );

    batchResults.forEach(dishes => results.push(...dishes));
  }

  return results;
}

// ── Step 2: Batch nutrition estimation ───────────────────────────────────────

export async function estimateNutritionBatch(dishes) {
  if (!dishes || dishes.length === 0) return [];

  const dishList = dishes
    .map((d, i) => (i + 1) + '. Name: "' + d.name + '" | Description: "' + (d.description || 'none') + '"')
    .join('\n');

  const prompt = [
    'You are a precise nutritionist AI with expert knowledge of all restaurant food and beverages.',
    '',
    'Below is a list of menu items. For EACH item, provide accurate nutritional estimates.',
    '',
    'MENU ITEMS:',
    dishList,
    '',
    'CRITICAL RULES you MUST follow:',
    '- BEVERAGES (coffee, tea, juice, soda, water, smoothie, latte, cappuccino, americano, espresso):',
    '  -> calories 0-150 max for plain drinks, protein ~0g, fat ~0g, cookingMethod = "raw"',
    '- DESSERTS (cake, ice cream, brownie, cookie, pastry):',
    '  -> high carbs, low protein, cookingMethod = "baked" or "raw"',
    '- SALADS: low calories, low fat unless dressing-heavy, cookingMethod = "raw"',
    '- GRILLED MEAT/FISH: high protein (20-40g), moderate fat, cookingMethod = "grilled"',
    '- FRIED ITEMS: higher fat, cookingMethod = "fried"',
    '- Never assign food macros to beverages or beverage macros to food',
    '- estimatedIngredients must list REAL ingredients',
    '- confidence: be honest, set below 50 if uncertain',
    '',
    'Return ONLY a raw JSON array (no markdown, no code fences, no explanation) with exactly ' + dishes.length + ' objects in the same order as the input list:',
    '[',
    '  {',
    '    "name": "exact dish name from input",',
    '    "calories": {"min": number, "max": number},',
    '    "protein": {"min": number, "max": number},',
    '    "carbs": {"min": number, "max": number},',
    '    "fat": {"min": number, "max": number},',
    '    "cookingMethod": "grilled" | "fried" | "steamed" | "baked" | "raw" | "unknown",',
    '    "estimatedIngredients": ["ingredient1", "ingredient2"],',
    '    "confidence": number 0-100,',
    '    "recommendReason": "one honest sentence about a nutritional positive",',
    '    "avoidReasons": ["concern1"] or []',
    '  }',
    ']',
  ].join('\n');

  let raw = '';
  try {
    const response = await groq.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a precise nutritionist. Give accurate, realistic nutritional data for every menu item. Beverages like Americano have ~5-15 kcal and ~0g protein. Never confuse beverages with food.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });

    raw = stripMarkdown(response.choices[0]?.message?.content || '');
    const parsed = repairAndParseArray(raw);

    if (!Array.isArray(parsed)) {
      console.error('[groq.service] estimateNutritionBatch: response is not an array\nRaw:', raw);
      return dishes.map(() => null);
    }

    return dishes.map((dish, i) => {
      const item = parsed[i] || null;
      if (item) item.source = 'ai';
      return item;
    });
  } catch (err) {
    console.error('[groq.service] estimateNutritionBatch: failed\nRaw:', raw, '\nError:', err.message);
    return dishes.map(() => null);
  }
}

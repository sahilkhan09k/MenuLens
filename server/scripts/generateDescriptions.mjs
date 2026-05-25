/**
 * generateDescriptions.mjs
 *
 * One-time script to generate culinary descriptions for all FoodItem documents
 * that don't already have a description.
 *
 * Uses Groq batch calls (20 dishes per call) to minimize API usage.
 * Uses upsert: false — only updates the description field, never touches other fields.
 *
 * Run: node scripts/generateDescriptions.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Groq from 'groq-sdk';
import FoodItem from '../models/FoodItem.model.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const BATCH_SIZE = 20;
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

async function generateDescriptionsBatch(dishes) {
  const dishList = dishes
    .map((d, i) => (i + 1) + '. "' + d.display_name_en + '" (category: ' + (d.category || 'unknown') + ', cooking: ' + (d.cooking_method || 'unknown') + ')')
    .join('\n');

  const prompt = [
    'You are an expert on Indian cuisine. For each dish below, write a rich description covering:',
    '- Key ingredients and how the dish is prepared',
    '- Flavour profile: taste, texture, spice level, aroma',
    '- Cultural and regional origin — where it comes from, its significance in Indian food culture',
    '',
    'Aim for 4-6 sentences per dish. Write for someone unfamiliar with Indian food. Be accurate and engaging.',
    '',
    'DISHES:',
    dishList,
    '',
    'Return ONLY a raw JSON array with exactly ' + dishes.length + ' objects in the same order:',
    '[',
    '  { "name": "exact dish name from input", "description": "4-6 sentence rich description covering ingredients, flavour, and cultural origin" }',
    ']',
  ].join('\n');

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are an expert on Indian cuisine. Write accurate, concise dish descriptions.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4096,
    temperature: 0.3,
  });

  const raw = (response.choices[0]?.message?.content || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    console.error('[generateDescriptions] JSON parse failed for batch');
    return null;
  }
}

async function main() {
  console.log('[generateDescriptions] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[generateDescriptions] Connected.');

  // Process dishes — regenerate all descriptions with the richer prompt
  // (pass --reset flag to force regeneration of existing descriptions)
  const forceReset = process.argv.includes('--reset');
  const filter = forceReset
    ? {}  // regenerate all
    : { description: { $in: [null, '', undefined] } };  // only missing ones

  const total = await FoodItem.countDocuments(filter);
  console.log('[generateDescriptions] Dishes to process: ' + total + (forceReset ? ' (force reset mode)' : ' (missing descriptions only)'));

  if (total === 0) {
    console.log('[generateDescriptions] All dishes already have descriptions. Done.');
    await mongoose.disconnect();
    return;
  }

  let processed = 0;
  let updated = 0;
  let errors = 0;

  const cursor = FoodItem.find(filter)
    .select('_id display_name_en category cooking_method')
    .lean()
    .cursor();

  let batch = [];

  const processBatch = async () => {
    if (batch.length === 0) return;

    const results = await generateDescriptionsBatch(batch);
    if (!results) {
      errors += batch.length;
      batch = [];
      return;
    }

    // Update only the description field — never touch other fields
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const result = results[i];
      if (result?.description) {
        await FoodItem.updateOne(
          { _id: item._id },
          { $set: { description: result.description } }
        );
        updated++;
      } else {
        errors++;
      }
    }

    processed += batch.length;
    console.log('[generateDescriptions] Progress: ' + processed + '/' + total + ' — updated: ' + updated + ', errors: ' + errors);
    batch = [];

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  };

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await processBatch();
    }
  }

  // Process remaining
  await processBatch();

  console.log('\n[generateDescriptions] Complete!');
  console.log('Total processed: ' + processed);
  console.log('Updated:         ' + updated);
  console.log('Errors:          ' + errors);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[generateDescriptions] Fatal:', err.message);
  process.exit(1);
});

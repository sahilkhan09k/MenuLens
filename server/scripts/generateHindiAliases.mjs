/**
 * generateHindiAliases.mjs
 *
 * ONE-TIME script. Generates Hindi aliases for all INDB dishes using Groq.
 * Output saved to server/data/hindi_aliases.json — permanent reference data.
 * Never needs to be re-run unless new dishes are added.
 *
 * Usage: node scripts/generateHindiAliases.mjs
 * Cost: ~1-2 Groq API calls per batch of 30 dishes. Free tier sufficient.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const OUTPUT_FILE = path.resolve(__dirname, '../data/hindi_aliases.json');
const XLSX_FILE = path.resolve(__dirname, '../../Anuvaad_INDB_2024.11.xlsx');

function stripMarkdown(raw) {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

async function getHindiAliases(dishNames) {
  const prompt = `You are an expert in Indian cuisine and Hindi language.
For each Indian dish name below, provide the Hindi translation.

Return ONLY a raw JSON object (no markdown, no code fences):
{
  "dish name in lowercase": {
    "hi_devanagari": ["Hindi name in Devanagari script", "alternate if any"],
    "hi_roman": ["Hindi name romanized in English letters", "alternate if any"]
  }
}

Rules:
- Use common Hindi names that appear on Indian restaurant menus
- For dishes that are already Hindi names (like "Dal Makhani"), still provide Devanagari
- For English-origin dishes (like "Sandwich"), provide the commonly used Hindi transliteration
- Keep hi_roman as how it sounds phonetically in English letters
- Maximum 2 variants per field

Dishes:
${dishNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'system', content: 'You are an expert in Indian cuisine and Hindi language. Always return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const raw = stripMarkdown(response.choices[0]?.message?.content || '');
  return JSON.parse(raw);
}

async function run() {
  // Load existing results if any (resume support)
  let results = {};
  if (existsSync(OUTPUT_FILE)) {
    try {
      results = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'));
      console.log(`[hindi] Resuming — ${Object.keys(results).length} dishes already processed`);
    } catch { results = {}; }
  }

  // Read all dish names from XLSX
  const wb = XLSX.readFile(XLSX_FILE);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const allNames = rows.map(r => r.food_name?.trim()).filter(Boolean);

  // Filter out already processed
  const remaining = allNames.filter(n => !results[n.toLowerCase()]);
  console.log(`[hindi] ${remaining.length} dishes to process (${allNames.length - remaining.length} already done)`);

  const BATCH_SIZE = 25;
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

    console.log(`[hindi] Batch ${batchNum}/${totalBatches}: ${batch[0]} ... ${batch[batch.length - 1]}`);

    try {
      const batchResult = await getHindiAliases(batch);

      // Normalize keys to lowercase
      for (const [key, val] of Object.entries(batchResult)) {
        results[key.toLowerCase()] = val;
      }

      processed += batch.length;
      // Save after every batch — don't lose progress
      writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      console.log(`[hindi] Saved. Total: ${Object.keys(results).length} dishes`);
    } catch (err) {
      errors++;
      console.error(`[hindi] Batch ${batchNum} failed:`, err.message);
      // Continue with next batch
    }

    // Rate limit — 1 second between batches
    if (i + BATCH_SIZE < remaining.length) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  console.log(`\n[hindi] Complete!`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Total in file: ${Object.keys(results).length}`);
  console.log(`  Output: ${OUTPUT_FILE}`);
}

run().catch(err => {
  console.error('[hindi] Fatal:', err);
  process.exit(1);
});

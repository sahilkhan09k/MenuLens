/**
 * dishPhoto.service.js
 *
 * Fetches a food photo from Unsplash, re-hosts on Cloudinary for CORS-safe html2canvas.
 * Uses dish-type-aware search queries for better photo accuracy.
 */

import cloudinary from '../config/cloudinary.js';

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Dish-type aware search query builder
// Generic "dish + indian food" returns wrong photos for regional dishes
function buildSearchQuery(dishName) {
  const name = dishName.toLowerCase();

  // Thalis — be very specific
  if (name.includes('gujarati thali') || name.includes('gujrati thali')) return 'gujarati thali dhokla thepla';
  if (name.includes('rajasthani thali')) return 'rajasthani thali dal baati churma';
  if (name.includes('punjabi thali')) return 'punjabi thali food';
  if (name.includes('south indian thali')) return 'south indian meals rice sambar';
  if (name.includes('thali')) return dishName + ' indian thali food';

  // Biryani variants
  if (name.includes('biryani')) return dishName + ' biryani rice indian';

  // Tandoori items
  if (name.includes('tandoori chicken')) return 'tandoori chicken red spiced grilled';
  if (name.includes('tandoori')) return dishName + ' tandoor clay oven indian';

  // Soups
  if (name.includes('soup')) return dishName + ' soup bowl indian';

  // Desserts
  if (name.includes('gulab jamun')) return 'gulab jamun syrup dessert indian';
  if (name.includes('rasmalai')) return 'rasmalai dessert indian sweet';
  if (name.includes('halwa')) return dishName + ' halwa indian dessert';
  if (name.includes('jalebi')) return 'jalebi indian dessert sweet';
  if (name.includes('ladoo') || name.includes('laddu')) return 'ladoo indian sweet';

  // Chaat / street food
  if (name.includes('samosa')) return 'samosa indian fried crispy';
  if (name.includes('pav bhaji')) return 'pav bhaji mumbai street food';
  if (name.includes('vada pav')) return 'vada pav mumbai street food';
  if (name.includes('dhokla')) return 'dhokla gujarati steamed snack';

  // Default — dish name + indian food
  const cleanName = dishName
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\s*(dry|gravy|boneless|half|full|semi gravy)\s*/gi, ' ')
    .replace(/\s*[\/\\]\s*.*/g, '')
    .trim();

  return cleanName + ' indian food dish';
}

export async function fetchAndUploadDishPhoto(dishName) {
  if (!UNSPLASH_KEY) {
    console.warn('[dishPhoto] UNSPLASH_ACCESS_KEY not set — skipping photo fetch');
    return null;
  }

  try {
    const query = buildSearchQuery(dishName);
    console.log('[dishPhoto] Searching Unsplash: "' + query + '" for dish: ' + dishName);

    const searchUrl = 'https://api.unsplash.com/search/photos?query=' +
      encodeURIComponent(query) +
      '&per_page=3&orientation=landscape&content_filter=high';

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: 'Client-ID ' + UNSPLASH_KEY },
    });

    if (!searchRes.ok) {
      console.warn('[dishPhoto] Unsplash search failed:', searchRes.status);
      return null;
    }

    const data = await searchRes.json();

    if (!data.results || data.results.length === 0) {
      console.log('[dishPhoto] No Unsplash result for: ' + query);
      return null;
    }

    // Pick best result — prefer food-tagged photos
    const best = data.results.find(r =>
      r.topic_submissions?.food_drink || r.tags?.some(t => t.title?.toLowerCase().includes('food'))
    ) || data.results[0];

    const rawUrl = best.urls?.regular;
    if (!rawUrl) return null;

    const optimizedUrl = rawUrl + '&w=800&q=80';

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(optimizedUrl, {
        folder: 'menulens/dish-photos',
        resource_type: 'image',
        transformation: [{ width: 720, height: 1280, crop: 'fill', gravity: 'auto', quality: 85 }],
      }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    console.log('[dishPhoto] Uploaded: ' + uploadResult.secure_url);
    return uploadResult.secure_url;

  } catch (err) {
    console.warn('[dishPhoto] Failed for "' + dishName + '":', err.message);
    return null;
  }
}

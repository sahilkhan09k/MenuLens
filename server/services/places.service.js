/**
 * places.service.js
 *
 * Uses Google Places API to find the nearest restaurant from GPS coordinates.
 * Called when a scan is uploaded with lat/lng.
 * Returns restaurant name and address to auto-fill on the Scan document.
 */

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

/**
 * Find the nearest restaurant to given coordinates.
 * Returns { name, address, placeId } or null if not found / API unavailable.
 */
export async function findNearestRestaurant(lat, lng) {
  if (!PLACES_API_KEY) {
    console.warn('[places] GOOGLE_PLACES_API_KEY not set — skipping restaurant lookup');
    return null;
  }

  try {
    // Use Places Nearby Search — find restaurants within 50m
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=50&type=restaurant&key=${PLACES_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) {
      // Try wider radius (100m) if nothing found at 50m
      const url2 = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=100&type=restaurant&key=${PLACES_API_KEY}`;
      const res2 = await fetch(url2);
      const data2 = await res2.json();

      if (data2.status !== 'OK' || !data2.results?.length) return null;

      const place = data2.results[0];
      return {
        name: place.name,
        address: place.vicinity || '',
        placeId: place.place_id,
      };
    }

    const place = data.results[0];
    return {
      name: place.name,
      address: place.vicinity || '',
      placeId: place.place_id,
    };
  } catch (err) {
    console.error('[places] findNearestRestaurant error:', err.message);
    return null;
  }
}

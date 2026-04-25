/**
 * places.service.js
 * Uses Google Places API (New) Nearby Search to find the nearest restaurant.
 */

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function findNearestRestaurant(lat, lng) {
  if (!PLACES_API_KEY) {
    console.warn('[places] GOOGLE_PLACES_API_KEY not set — skipping restaurant lookup');
    return null;
  }

  // Try 50m radius first, then 150m
  for (const radius of [50, 150]) {
    try {
      const body = {
        includedTypes: ['restaurant', 'food'],
        maxResultCount: 1,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius,
          },
        },
      };

      const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.id',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        const result = {
          name: place.displayName?.text || '',
          address: place.formattedAddress || '',
          placeId: place.id || '',
        };
        console.log('[places] Found restaurant at ' + radius + 'm: ' + result.name);
        return result;
      }
    } catch (err) {
      console.error('[places] findNearestRestaurant error at radius ' + radius + ':', err.message);
    }
  }

  console.log('[places] No restaurant found nearby');
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// Mekan sağlayıcıları — her biri ham kayıt dizisi döndürür.
//
// Sözleşme: fetchArea({ lat, lng, radiusM }) → [{ provider, externalId, raw }]
// Normalizasyon burada YAPILMAZ; ham yanıt olduğu gibi saklanır ki
// normalize kuralı değişince yeniden çekmeden yeniden işlenebilsin.
// ═══════════════════════════════════════════════════════════════════════

const UA = "GUR/1.0 (+https://gur.app; ingestion)";

/** Sağlayıcı anahtarı yoksa o sağlayıcı sessizce atlanır — çalıştırma kırılmaz. */
function keyed(name, value) {
  if (!value) {
    console.warn(`[ingest] ${name} atlandı: API anahtarı tanımlı değil`);
    return false;
  }
  return true;
}

async function getJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url.split("?")[0]}`);
  return res.json();
}

// ─── Google Places (New) ──────────────────────────────────────────────
// searchNearby: POST, alan maskesi zorunlu — istenmeyen alan faturalandırılmaz.
export const googlePlaces = {
  id: "google_places",
  async fetchArea({ lat, lng, radiusM = 1500, maxResults = 20 }) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!keyed("google_places", key)) return [];

    const body = {
      includedTypes: ["restaurant", "cafe", "bakery", "bar"],
      maxResultCount: Math.min(maxResults, 20),
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } },
      languageCode: "tr",
      regionCode: "TR",
    };
    const fields = [
      "places.id", "places.displayName", "places.formattedAddress", "places.location",
      "places.rating", "places.userRatingCount", "places.priceLevel", "places.primaryType",
      "places.types", "places.photos", "places.regularOpeningHours", "places.nationalPhoneNumber",
      "places.websiteUri", "places.editorialSummary",
    ].join(",");

    const data = await getJson("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fields,
      },
      body: JSON.stringify(body),
    });

    return (data.places || []).map(p => ({
      provider: "google_places",
      externalId: p.id,
      raw: p,
    }));
  },
};

// ─── Foursquare Places ────────────────────────────────────────────────
export const foursquare = {
  id: "foursquare",
  async fetchArea({ lat, lng, radiusM = 1500, maxResults = 50 }) {
    const key = process.env.FOURSQUARE_API_KEY;
    if (!keyed("foursquare", key)) return [];

    const params = new URLSearchParams({
      ll: `${lat},${lng}`,
      radius: String(radiusM),
      categories: "13000",              // Dining and Drinking
      limit: String(Math.min(maxResults, 50)),
      fields: "fsq_id,name,location,geocodes,categories,rating,stats,price,tel,website,hours,photos,description",
    });

    const data = await getJson(`https://api.foursquare.com/v3/places/search?${params}`, {
      headers: { Authorization: key, Accept: "application/json" },
    });

    return (data.results || []).map(p => ({
      provider: "foursquare",
      externalId: p.fsq_id,
      raw: p,
    }));
  },
};

// ─── Tripadvisor Content API ──────────────────────────────────────────
// Yalnızca puan/yorum zenginleştirmesi için; ana havuz kaynağı değil,
// çünkü coğrafi arama yarıçapı ve kota sınırları dar.
export const tripadvisor = {
  id: "tripadvisor",
  async fetchArea({ lat, lng }) {
    const key = process.env.TRIPADVISOR_API_KEY;
    if (!keyed("tripadvisor", key)) return [];

    const params = new URLSearchParams({
      key, latLong: `${lat},${lng}`, category: "restaurants", language: "tr",
    });
    const data = await getJson(`https://api.content.tripadvisor.com/api/v1/location/nearby_search?${params}`);
    return (data.data || []).map(p => ({
      provider: "tripadvisor",
      externalId: String(p.location_id),
      raw: p,
    }));
  },
};

// ─── OpenStreetMap / Overpass ─────────────────────────────────────────
// Ücretsiz ve anahtarsız: her zaman çalışır, diğerleri anahtarsızsa
// havuzun tek kaynağı olarak kalır. Nazik davranmak için düşük hız.
export const openStreetMap = {
  id: "osm",
  async fetchArea({ lat, lng, radiusM = 1500 }) {
    const query =
      `[out:json][timeout:25];` +
      `node["amenity"~"restaurant|cafe|fast_food"]["name"](around:${radiusM},${lat},${lng});` +
      `out body 200;`;
    const data = await getJson("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
    });
    return (data.elements || [])
      .filter(el => el.tags?.name)
      .map(el => ({ provider: "osm", externalId: String(el.id), raw: el }));
  },
};

// Sıra önemli: sonra gelen sağlayıcı, boş alanları doldurur ama
// dolu alanı ezmez (bkz. normalize.js → mergeRecords).
export const PROVIDERS = [googlePlaces, foursquare, openStreetMap, tripadvisor];

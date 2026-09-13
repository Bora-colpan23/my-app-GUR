// ═══════════════════════════════════════════════════════════════════════
// Ham sağlayıcı yanıtlarını tek şemaya indirger ve aynı mekânı eşleştirir.
// ═══════════════════════════════════════════════════════════════════════

import { distanceMeters } from "../../../shared/deeplink.js";

// OSM/Foursquare/Google mutfak etiketlerini GUR kategorilerine eşler.
const CATEGORY_MAP = {
  turkish: "Türk Mutfağı", kebab: "Türk Mutfağı", regional: "Türk Mutfağı", anatolian: "Türk Mutfağı",
  japanese: "Uzak Doğu", sushi: "Uzak Doğu", chinese: "Uzak Doğu", asian: "Uzak Doğu",
  thai: "Uzak Doğu", korean: "Uzak Doğu", vietnamese: "Uzak Doğu", ramen: "Uzak Doğu",
  italian: "İtalyan", pizza: "İtalyan", pasta: "İtalyan",
  burger: "Fast Food", fast_food: "Fast Food", sandwich: "Fast Food", chicken: "Fast Food",
  seafood: "Deniz Ürünleri", fish: "Deniz Ürünleri",
  coffee_shop: "Kafe", cafe: "Kafe", breakfast: "Kafe", bakery: "Kafe",
  dessert: "Tatlıcı", ice_cream: "Tatlıcı", cake: "Tatlıcı", baklava: "Tatlıcı",
  indian: "Hint", curry: "Hint",
  vegetarian: "Sağlıklı", vegan: "Sağlıklı", salad: "Sağlıklı",
  barbecue: "Mangal", grill: "Mangal", steak_house: "Mangal", steak: "Mangal",
  bar: "Gece Hayatı", pub: "Gece Hayatı", cocktail: "Gece Hayatı",
};

function toCategory(...hints) {
  for (const h of hints.flat().filter(Boolean)) {
    const k = String(h).toLowerCase().replace(/[\s-]+/g, "_");
    if (CATEGORY_MAP[k]) return CATEGORY_MAP[k];
    for (const [key, val] of Object.entries(CATEGORY_MAP)) if (k.includes(key)) return val;
  }
  return "Türk Mutfağı";
}

// Google PRICE_LEVEL_MODERATE → 2; Foursquare zaten 1-4.
function toPriceLevel(v) {
  if (typeof v === "number") return Math.min(4, Math.max(1, v));
  const map = {
    PRICE_LEVEL_FREE: 1, PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[v] || null;
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function googleHours(oh) {
  if (!oh?.periods) return null;
  const out = {};
  for (const p of oh.periods) {
    if (p.open?.day == null) continue;
    const d = DAYS[p.open.day];
    const pad = (t) => `${String(t.hour ?? 0).padStart(2, "0")}:${String(t.minute ?? 0).padStart(2, "0")}`;
    (out[d] ||= []).push([pad(p.open), p.close ? pad(p.close) : "24:00"]);
  }
  return Object.keys(out).length ? out : null;
}

/** Tek ham kaydı ortak şekle indirger. Tanımadığı alanı null bırakır. */
export function normalize(record) {
  const { provider, externalId, raw } = record;

  if (provider === "google_places") {
    return {
      provider, externalId,
      name: raw.displayName?.text || null,
      category: toCategory(raw.primaryType, raw.types),
      description: raw.editorialSummary?.text || null,
      address: raw.formattedAddress || null,
      lat: raw.location?.latitude ?? null,
      lng: raw.location?.longitude ?? null,
      phone: raw.nationalPhoneNumber || null,
      website: raw.websiteUri || null,
      priceLevel: toPriceLevel(raw.priceLevel),
      rating: raw.rating ?? null,
      ratingCount: raw.userRatingCount ?? 0,
      hours: googleHours(raw.regularOpeningHours),
      // Google fotoğraf adı; URL'e çevirmek ayrı bir çağrı ve ayrı ücret.
      photos: (raw.photos || []).slice(0, 8).map(p => ({
        ref: p.name, width: p.widthPx, height: p.heightPx,
        attribution: p.authorAttributions?.[0]?.displayName || null,
      })),
      googlePlaceId: raw.id,
      tags: raw.types || [],
    };
  }

  if (provider === "foursquare") {
    const g = raw.geocodes?.main || {};
    return {
      provider, externalId,
      name: raw.name || null,
      category: toCategory(raw.categories?.map(c => c.name)),
      description: raw.description || null,
      address: raw.location?.formatted_address || null,
      district: raw.location?.neighborhood?.[0] || raw.location?.locality || null,
      lat: g.latitude ?? null,
      lng: g.longitude ?? null,
      phone: raw.tel || null,
      website: raw.website || null,
      priceLevel: toPriceLevel(raw.price),
      rating: raw.rating ? Number((raw.rating / 2).toFixed(1)) : null,  // FSQ 10'luk → 5'lik
      ratingCount: raw.stats?.total_ratings ?? 0,
      hours: null,
      photos: (raw.photos || []).slice(0, 8).map(p => ({
        url: `${p.prefix}800x600${p.suffix}`, width: 800, height: 600,
      })),
      tags: (raw.categories || []).map(c => c.name),
    };
  }

  if (provider === "tripadvisor") {
    return {
      provider, externalId,
      name: raw.name || null,
      category: toCategory(raw.category?.name),
      address: raw.address_obj?.address_string || null,
      lat: raw.latitude ? Number(raw.latitude) : null,
      lng: raw.longitude ? Number(raw.longitude) : null,
      rating: raw.rating ? Number(raw.rating) : null,
      ratingCount: raw.num_reviews ? Number(raw.num_reviews) : 0,
      photos: [], hours: null, tags: [],
    };
  }

  // OSM
  const t = raw.tags || {};
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" No:");
  return {
    provider, externalId,
    name: t.name || null,
    category: toCategory((t.cuisine || "").split(";")[0], t.amenity),
    description: t.description || null,
    address: street ? `${street}, ${t["addr:district"] || ""}`.replace(/, $/, "") : (t["addr:district"] || null),
    district: t["addr:district"] || t["addr:suburb"] || null,
    lat: raw.lat ?? null,
    lng: raw.lon ?? null,
    phone: t.phone || t["contact:phone"] || null,
    website: t.website || t["contact:website"] || null,
    priceLevel: null,
    rating: null, ratingCount: 0,
    hours: null,
    photos: [],
    tags: [t.cuisine, t.amenity].filter(Boolean),
  };
}

/**
 * İki normalize kayıt aynı mekan mı?
 * Ad benzerliği tek başına yetmez (aynı zincirin iki şubesi), koordinat tek
 * başına yetmez (aynı binada iki mekan) — ikisi birlikte karar verir.
 */
const MATCH_RADIUS_M = 60;

function slug(name) {
  return (name || "")
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(restaurant|restoran|cafe|kafe|lokanta|ocakbaşı|the|and|ve)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function nameSimilarity(a, b) {
  const x = slug(a), y = slug(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const xt = new Set(x.split(" ")), yt = new Set(y.split(" "));
  let hit = 0;
  for (const t of xt) if (yt.has(t)) hit++;
  return (2 * hit) / (xt.size + yt.size);      // Sørensen–Dice
}

export function isSamePlace(a, b) {
  if (a.lat == null || b.lat == null) return nameSimilarity(a.name, b.name) > 0.9;
  const d = distanceMeters(a, b);
  if (d > MATCH_RADIUS_M) return false;
  const sim = nameSimilarity(a.name, b.name);
  // Çok yakınsa isimde daha toleranslıyız, uzaklaştıkça isim netleşmeli.
  return d < 15 ? sim >= 0.5 : sim >= 0.7;
}

/**
 * Kayıtları birleştirir: önce gelen kazanır, sonrakiler yalnızca boş alanı
 * doldurur. PROVIDERS sırası bu yüzden kalite sırasıdır.
 * Puan/yorum sayısında en yüksek yorum sayısına sahip kaynak kazanır —
 * 5 yorumlu 5.0, 900 yorumlu 4.3'ten daha az bilgi taşır.
 */
export function mergeRecords(records) {
  const [first, ...rest] = records;
  const merged = { ...first, sources: [{ provider: first.provider, externalId: first.externalId }] };
  merged.photos = [...(first.photos || [])];

  for (const r of rest) {
    merged.sources.push({ provider: r.provider, externalId: r.externalId });
    for (const [k, v] of Object.entries(r)) {
      if (k === "photos" || k === "provider" || k === "externalId" || k === "sources") continue;
      const cur = merged[k];
      if (cur == null || cur === "" || (Array.isArray(cur) && cur.length === 0)) merged[k] = v;
    }
    if ((r.ratingCount || 0) > (merged.ratingCount || 0) && r.rating != null) {
      merged.rating = r.rating;
      merged.ratingCount = r.ratingCount;
    }
    merged.photos.push(...(r.photos || []));
  }

  merged.photos = merged.photos.slice(0, 12);
  merged.tags = [...new Set((merged.tags || []).filter(Boolean).map(String))].slice(0, 8);
  return merged;
}

/** Aynı alandan gelen tüm kayıtları kümeleyip birleştirir. */
export function dedupe(normalized) {
  const clusters = [];
  for (const rec of normalized) {
    if (!rec.name || rec.lat == null) continue;      // adı ya da konumu yoksa kullanılamaz
    const hit = clusters.find(c => isSamePlace(c[0], rec));
    if (hit) hit.push(rec); else clusters.push([rec]);
  }
  return clusters.map(mergeRecords);
}

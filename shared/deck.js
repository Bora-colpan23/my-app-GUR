// ═══════════════════════════════════════════════════════════════════════
// Kart destesi kurgusu — sponsorlu kartların organik akışa harmanlanması.
//
// Saf: veritabanı ya da DOM bilmez. Sunucu gerçek kampanyalarla, istemci
// demo kampanyalarıyla aynı fonksiyonu çağırır; yerleşim hissi ikisinde
// birebir aynı olsun diye tek yerde duruyor.
// ═══════════════════════════════════════════════════════════════════════

export const DECK_RULES = {
  // 5-7 organik kart arasına 1 sponsorlu. Sabit değil: sabit aralık
  // kullanıcı tarafından fark edilip "reklam sırası geldi" hissi yaratıyor.
  minGap: 5,
  maxGap: 7,
  // İlk kartlar hiç sponsorlu olmasın — açılış izlenimi organik kalsın.
  leadIn: 3,
  // Bir destede aynı kampanya en fazla bir kez.
  maxPerCampaign: 1,
  // Bir KULLANICIYA aynı kampanya ömür boyu en fazla bir kez. Deste her
  // açılışta yeniden kurulduğu için deste içi sınır yetmiyor; daha önce
  // gösterilmiş kampanyalar havuzdan tamamen çıkarılır.
  maxPerUser: 1,
};

/** Deterministik PRNG — aynı kullanıcı+gün aynı yerleşimi görür. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Açık artırma: teklifi en yüksek olan kazanır ama tek başına değil.
 * Skor = teklif × kalite. Kalite, kullanıcının o kartı sağa kaydırma
 * olasılığını temsil eder; yalnız paraya bakan bir sıralama, deneyimi
 * bozarak uzun vadede geliri de düşürür.
 */
export function rankCampaigns(campaigns, { category = null } = {}) {
  return campaigns
    .filter(c => c.status === "active" && c.remainingBudgetMinor > 0)
    .map(c => {
      const relevance = category && c.category === category ? 1.25 : 1;
      const quality = Math.min(1.5, Math.max(0.2, c.engagementRate ?? 0.5) * 2);
      return { ...c, score: c.bidMinor * quality * relevance };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Organik kartların arasına sponsorlu kartları yerleştirir.
 *
 * organic: [{ id, ... }]
 * campaigns: rankCampaigns çıktısı — her biri { id, restaurant, label, bidMinor, pricing }
 * seed: kullanıcı/gün — aynı desteyi tekrar üretebilmek için
 * seenCampaigns: bu kullanıcıya daha önce gösterilmiş kampanya kimlikleri;
 *   sıklık sınırı (frequency cap) burada uygulanır. Aynı reklamı ikinci kez
 *   göstermek hem kullanıcıyı yorar hem reklamvereni ölü gösterime boğar.
 *
 * Sponsorlu kartlar KONUMDAN BAĞIMSIZDIR: organik liste yakından uzağa
 * sıralanmış olsa bile kampanya kartı sırasını mesafe değil, açık artırma
 * skoru ve boşluk kuralı belirler. Reklamveren mesafeye göre elenmez.
 *
 * Dönen kartlar organikle aynı şekle sahiptir; tek fark `sponsored` alanı.
 * Böylece kart bileşeni sponsorlu/organik ayrımı yapmadan aynı şablonu çizer.
 */
export function buildDeck(organic, campaigns = [], { seed = 1, rules = DECK_RULES, seenCampaigns = [] } = {}) {
  const rand = mulberry32(hashSeed(seed));
  const seen = new Set((seenCampaigns || []).map(String));
  const pool = rules.maxPerUser
    ? campaigns.filter(c => !seen.has(String(c.id)))
    : campaigns.slice();
  const used = new Map();
  const deck = [];

  // Aynı mekan hem organik hem sponsorlu görünmesin.
  const organicIds = new Set(organic.map(o => String(o.id)));

  let nextSlot = rules.leadIn + rules.minGap +
    Math.floor(rand() * (rules.maxGap - rules.minGap + 1));

  for (let i = 0; i < organic.length; i++) {
    deck.push({ ...organic[i], sponsored: null, deckPosition: deck.length });

    if (deck.length >= nextSlot && pool.length) {
      const idx = pool.findIndex(c =>
        !organicIds.has(String(c.restaurant.id)) &&
        (used.get(c.id) || 0) < rules.maxPerCampaign);

      if (idx !== -1) {
        const c = pool[idx];
        used.set(c.id, (used.get(c.id) || 0) + 1);
        pool.splice(idx, 1);
        deck.push({
          ...c.restaurant,
          deckPosition: deck.length,
          // Kartın kendisi organikle aynı; rozet metni kampanyadan gelir.
          sponsored: {
            campaignId: c.id,
            label: c.label || "Öne Çıkan",
            pricing: c.pricing,
            bidMinor: c.bidMinor,
          },
        });
        nextSlot = deck.length + rules.minGap +
          Math.floor(rand() * (rules.maxGap - rules.minGap + 1));
      }
    }
  }

  return deck;
}

/**
 * Kaydırma kotası. Sayı istemciye HİÇ gönderilmez — yalnızca
 * "devam edebilir mi" ve "sınıra ne kadar kaldı" niteliksel sinyali.
 */
export const QUOTA = { freeDaily: 40, rewardBonus: 5, plusDaily: Infinity };

export function quotaState({ plan = "free", used = 0, bonus = 0 }) {
  const limit = plan === "free" ? QUOTA.freeDaily + bonus : QUOTA.plusDaily;
  const left = limit - used;
  return {
    allowed: left > 0,
    // Kullanıcıya gösterilen tek şey bu: yaklaşıyor mu, bitti mi.
    // Ham sayı arayüze asla sızmaz.
    pressure: left <= 0 ? "exhausted" : left <= 5 ? "near" : "free",
  };
}

// ═══════════════════════════════════════════════════════════════════════
// KONUM BAZLI SIRALAMA — deste yakından başlar, kaydırdıkça açılır
//
// Kullanıcı önce yürüme mesafesindeki mekânları görmeli; kaydırmaya devam
// ettikçe yarıçap büyümeli. Düz mesafe sıralaması bunu yapar ama sıkıcıdır
// ve her açılışta aynı diziyi verir — bu yüzden halkalar hâlinde
// çalışıyoruz: her halkanın İÇİ deterministik olarak karışık, halkalar
// yakından uzağa diziliyor. Sonuç: "gitgide uzaklaşan" bir akış, ama
// tahmin edilebilir olmayan bir sıra.
//
// Saf fonksiyon: istemci ve sunucu aynı sırayı üretsin diye burada.
// ═══════════════════════════════════════════════════════════════════════

export const RADIUS_RULES = {
  firstRingKm: 1.5,   // ilk halka: yürüme mesafesi
  stepKm: 2.5,        // her halkada eklenen yarıçap
  maxRings: 8,        // bundan uzağı tek bir "daha uzak" halkasında toplanır
};

const EARTH_R_KM = 6371;

/** İki koordinat arası mesafe (km) — Haversine. */
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Bir mesafenin hangi halkaya düştüğü (0 = en yakın). */
export function ringOf(km, rules = RADIUS_RULES) {
  if (!Number.isFinite(km)) return rules.maxRings;           // koordinatsız kayıt en sona
  if (km <= rules.firstRingKm) return 0;
  const n = 1 + Math.floor((km - rules.firstRingKm) / rules.stepKm);
  return Math.min(n, rules.maxRings);
}

/** Halkanın üst sınırı — arayüzde "≤3 km" gibi göstermek için. */
export function ringLabel(ring, rules = RADIUS_RULES) {
  if (ring >= rules.maxRings) return "daha uzak";
  const outer = rules.firstRingKm + ring * rules.stepKm;
  return `${outer % 1 === 0 ? outer : outer.toFixed(1)} km içinde`;
}

/**
 * Listeyi yakından uzağa, halka halka sıralar.
 *
 * origin yoksa (konum izni verilmemiş) liste olduğu gibi döner — konum
 * bilmediğimizde uydurma bir yakınlık iddia etmek, yanlış sıralamadan
 * daha kötü.
 *
 * Her kayda `distanceKm` ve `ring` eklenir; kart bunları olduğu gibi
 * gösterebilir.
 */
export function orderByProximity(list, origin, { seed = 1, rules = RADIUS_RULES } = {}) {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    return list.map(r => ({ ...r, distanceKm: null, ring: null }));
  }
  const rand = mulberry32(hashSeed(seed));
  const withRing = list.map(r => {
    const km = Number.isFinite(r.lat) && Number.isFinite(r.lng)
      ? distanceKm(origin, { lat: r.lat, lng: r.lng })
      : null;
    return { ...r, distanceKm: km, ring: ringOf(km, rules) };
  });

  // Halka içi karıştırma: sıralama deterministik ama mesafeye göre
  // "en yakın ilk" değil — aynı sokaktaki iki mekândan hangisinin önce
  // geleceği her gün aynı olmasın diye.
  const buckets = new Map();
  for (const r of withRing) {
    if (!buckets.has(r.ring)) buckets.set(r.ring, []);
    buckets.get(r.ring).push(r);
  }
  const out = [];
  for (const ring of [...buckets.keys()].sort((a, b) => a - b)) {
    const bucket = buckets.get(ring);
    for (let i = bucket.length - 1; i > 0; i--) {       // Fisher-Yates
      const j = Math.floor(rand() * (i + 1));
      [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
    }
    out.push(...bucket);
  }
  return out;
}

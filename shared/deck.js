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
 *
 * Dönen kartlar organikle aynı şekle sahiptir; tek fark `sponsored` alanı.
 * Böylece kart bileşeni sponsorlu/organik ayrımı yapmadan aynı şablonu çizer.
 */
export function buildDeck(organic, campaigns = [], { seed = 1, rules = DECK_RULES } = {}) {
  const rand = mulberry32(hashSeed(seed));
  const pool = campaigns.slice();
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

// ═══════════════════════════════════════════════════════════════════════
// Yerel kampanya envanteri.
//
// Sunucu kampanyaları campaigns tablosundan okur; istemci YEREL modda buradan.
// İkisi de shared/deck.js'teki aynı buildDeck/rankCampaigns'i çağırır ki
// yerleşim hissi birebir aynı olsun.
//
// BOŞ. Eskiden üç uydurma kampanya vardı; gerçek bir reklamveren olmadan
// sponsorlu kart göstermek, gerçek işletmelere ödemediği bir reklamı
// atfetmek olurdu. YEREL modda deste yalnızca organik kartlardan oluşur.
// ═══════════════════════════════════════════════════════════════════════

export const LOCAL_CAMPAIGNS = [];

/** Kampanyaları gerçek restoran kayıtlarına bağlar. */
export function hydrateCampaigns(restaurants) {
  return LOCAL_CAMPAIGNS
    .map(c => {
      const restaurant = restaurants.find(r => String(r.id) === String(c.restaurantId));
      return restaurant ? { ...c, restaurant } : null;
    })
    .filter(Boolean);
}

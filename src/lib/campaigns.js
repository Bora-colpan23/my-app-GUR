// ═══════════════════════════════════════════════════════════════════════
// Demo kampanya envanteri.
//
// Sunucu bunları campaigns tablosundan okur; istemci demo modunda buradan.
// İkisi de shared/deck.js'teki aynı buildDeck/rankCampaigns'i çağırır ki
// yerleşim hissi birebir aynı olsun.
// ═══════════════════════════════════════════════════════════════════════

export const DEMO_CAMPAIGNS = [
  {
    id: "cmp-1", label: "Öne Çıkan", pricing: "cpe",
    bidMinor: 240, remainingBudgetMinor: 180000, status: "active",
    engagementRate: 0.62, category: "Türk Mutfağı",
    restaurantId: 3,
  },
  {
    id: "cmp-2", label: "Şefin Önerisi", pricing: "cpc",
    bidMinor: 180, remainingBudgetMinor: 90000, status: "active",
    engagementRate: 0.48, category: "Deniz Ürünleri",
    restaurantId: 6,
  },
  {
    id: "cmp-3", label: "Öne Çıkan", pricing: "cpe",
    bidMinor: 310, remainingBudgetMinor: 42000, status: "active",
    engagementRate: 0.71, category: "İtalyan",
    restaurantId: 11,
  },
];

/** Kampanyaları gerçek restoran kayıtlarına bağlar. */
export function hydrateCampaigns(restaurants) {
  return DEMO_CAMPAIGNS
    .map(c => {
      const restaurant = restaurants.find(r => String(r.id) === String(c.restaurantId));
      return restaurant ? { ...c, restaurant } : null;
    })
    .filter(Boolean);
}

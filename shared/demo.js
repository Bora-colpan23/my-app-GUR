// ═══════════════════════════════════════════════════════════════════════
// DEMO ROLLERİ — hangi Bakırköy kaydı hangi demo rolünü oynuyor.
//
// Yönetici paneli, kampanya envanteri ve "Doyurucu" demo girişi örnek bir
// müşteri gerektiriyor; gerçek müşterimiz yok. Roller Bakırköy listesindeki
// kayıtlara bağlandı (anahtar = shared/bakirkoy.js → `anahtar`). İstemci
// (src/data/restaurants.js, campaigns.js, GurAdmin.jsx) ve sunucu tohumu
// (server/db/seed.js) aynı tabloyu okur: biri değişirse öbürü ayrışmasın.
//
// BU BİR DEMO: kayıtlar gerçek işletmeler, ama aralarındaki ticari ilişki
// (müşteri, kampanya, satın alınan hizmet, fırsat) UYDURMA. Gerçek bir müşteri
// gelmeden önce bu tablo ve onu okuyan tohumlar silinmeli.
// Gastro Onaylı burada YOK: rozet bağımsız şef değerlendirmesidir ve gerçek
// bir işletmeye uydurma şef adıyla verilmez.
// ═══════════════════════════════════════════════════════════════════════

export const DEMO_ROLLER = {
  sahip: "pizza-krema-bakirkoy",             // Doyurucu demo girişi + yönetici müşteri listesi
  musteriler: {
    steak: "etci-mehmet-bakirkoy-steakhouse",
    lokanta: "vento-romano",
    turk: "abdulkadir-restaurant",
    burger: "burger-yiyelim",
    pastane: "dilek-pastanesi-zuhuratbaba",
    meyhane: "bakirkoy-meyhanesi-yeni-nesil-meyhane",
  },
  askida: "hadiqa-cafe-lounge",              // yönetici panelinde "askıda" örneği
  kampanyalar: {
    turk: "abdulkadir-restaurant",
    balik: "meshur-balikciniz-bayram",
    italyan: "gusto-napoletano",
    kafe: "hadiqa-cafe-lounge",
  },
};

/** İstemcideki kayıt kimliği. */
export const demoId = (anahtar) => `bkr-${anahtar}`;

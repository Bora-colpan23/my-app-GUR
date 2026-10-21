// ═══════════════════════════════════════════════════════════════════════
// MEKAN HAVUZU — üç uygulamanın ortak verisi
//
// Restoran kaydı tüketici uygulamasının malı değil: işletme uygulaması
// hangi mekanı yönettiğini, yönetici paneli hangi mekanı denetlediğini
// aynı listeden okur. Gerçek dağıtımda burası sunucudaki restaurants
// tablosudur; demo modda tohum liste burada duruyor.
// ═══════════════════════════════════════════════════════════════════════

import { BAKIRKOY, BAKIRKOY_ILCE } from '../../shared/bakirkoy.js';

// ═══════════════════════════════════════════════
// IMAGES
// ═══════════════════════════════════════════════
export const I = {
  hero: "https://picsum.photos/seed/gur-hero/800/400",
  turkish1: "https://picsum.photos/seed/turkish1/600/400",
  turkish2: "https://picsum.photos/seed/turkish2/600/400",
  sushi1: "https://picsum.photos/seed/sushi1/600/400",
  sushi2: "https://picsum.photos/seed/sushi2/600/400",
  healthy1: "https://picsum.photos/seed/healthy1/600/400",
  healthy2: "https://picsum.photos/seed/healthy2/600/400",
  bbq1: "https://picsum.photos/seed/bbq1/600/400",
  bbq2: "https://picsum.photos/seed/bbq2/600/400",
  night1: "https://picsum.photos/seed/night1/600/400",
  cocktail1: "https://picsum.photos/seed/cocktail1/600/400",
  cafe1: "https://picsum.photos/seed/cafe1/600/400",
  cafe2: "https://picsum.photos/seed/cafe2/600/400",
  pasta1: "https://picsum.photos/seed/pasta1/600/400",
  pizza1: "https://picsum.photos/seed/pizza1/600/400",
  burger1: "https://picsum.photos/seed/burger1/600/400",
  steak1: "https://picsum.photos/seed/steak1/600/400",
  dessert1: "https://picsum.photos/seed/dessert1/600/400",
  seafood1: "https://picsum.photos/seed/seafood1/600/400",
  interior1: "https://picsum.photos/seed/interior1/600/400",
  interior2: "https://picsum.photos/seed/interior2/600/400",
  interior3: "https://picsum.photos/seed/interior3/600/400",
  bosphorus: "https://picsum.photos/seed/bosphorus/600/400",
  ramen1: "https://picsum.photos/seed/ramen1/600/400",
  dimsum1: "https://picsum.photos/seed/dimsum1/600/400",
  kebab1: "https://picsum.photos/seed/kebab1/600/400",
  salad1: "https://picsum.photos/seed/salad1/600/400",
  wine1: "https://picsum.photos/seed/wine1/600/400",
  bread1: "https://picsum.photos/seed/bread1/600/400",
  curry1: "https://picsum.photos/seed/curry1/600/400",
  rooftop1: "https://picsum.photos/seed/rooftop1/600/400",
  barista1: "https://picsum.photos/seed/barista1/600/400",
  icecream1: "https://picsum.photos/seed/icecream1/600/400",
  soup1: "https://picsum.photos/seed/soup1/600/400",
  taco1: "https://picsum.photos/seed/taco1/600/400",
};


// ═══════════════════════════════════════════════
// BAKIRKÖY LİSTESİ — dış kaynaktan gelen 218 kayıt (shared/bakirkoy.js)
//
// Tohum listeden FARKI: bunlar elle hazırlanmış değil, tablodan geldi ve
// tabloda olmayan alanlar BOŞ. Bu yüzden:
//   • lat/lng null — mekânın koordinatı yok. Yol tarifi isimle arama
//     açıyor, ziyaret doğrulaması bu kayıtları hiç eşleştirmiyor.
//   • area — yalnızca deste sıralaması için ilçe merkezi (bkz.
//     shared/deck.js → orderByProximity). Mesafe olarak GÖSTERİLMİYOR;
//     `dist` alanında ilçe adı yazıyor.
//   • price / hours boş; ekranlar boşken o satırı çizmiyor.
//   • gastro yok, claimed yok: rozet bağımsız şef değerlendirmesine
//     dayanır, puanla verilemez.
// Görseller diğer havuz kayıtlarıyla aynı yer tutucu (picsum): fotoğraf
// da tabloda yok.
// ═══════════════════════════════════════════════
export function bakirkoyToCard(k) {
  const id = `bkr-${k.anahtar}`;
  return {
    id,
    name: k.ad,
    cat: k.kategori,
    rating: k.puan,
    ratingCount: k.yorum,
    dist: BAKIRKOY_ILCE.ad,
    price: null,
    addr: k.adres,
    desc: `${k.tur}${k.mahalle ? ` · ${k.mahalle}` : ""}, ${BAKIRKOY_ILCE.ad}.`,
    imgs: [0, 1, 2].map(i => `https://picsum.photos/seed/${id}-${i}/600/400`),
    menu: [],
    hours: null,
    tags: [k.tur, k.mahalle].filter(Boolean),
    popular: [],
    lat: null, lng: null,
    area: { lat: BAKIRKOY_ILCE.lat, lng: BAKIRKOY_ILCE.lng },
    district: BAKIRKOY_ILCE.ad,
    phone: k.telefon,
    website: k.web,
    email: k.eposta,
    instagram: k.instagram,
    facebook: k.facebook,
    source: "api",
  };
}

/**
 * MEKAN HAVUZU = Bakırköy listesi. Eskiden burada 15 elle yazılmış demo mekân
 * vardı; ana data artık tablodan gelen 218 kayıt. Tüketici uygulaması, işletme
 * sahiplenme listesi, mobil paket ve sunucu tohumu aynı listeyi okur.
 * Demo müşteri / kampanya / fırsat YOK: gerçek müşterimiz gelene kadar boş.
 */
export const RESTAURANTS = BAKIRKOY.map(bakirkoyToCard);


// Doyurucu panelinden yüklenen görselleri, sahibi olduğu restoranın kendi
// dizilerine karıştırır. Tüm ekranlar (swipe kartı, detay galerisi, menü
// overlay'i, favoriler, profil) r.imgs / r.menu'den beslendiği için tek
// noktadan yapılan bu ekleme hepsine birden yansır.
export function withOwnerMedia(list, ownerId, media) {
  // Menü olarak PDF de yüklenebiliyor; galeri yalnızca görselleri gösterebilir.
  const isImg = (f) => !f.type || f.type.startsWith("image/");
  const photos = (media?.photos || []).filter(isImg);
  const menu = (media?.menu || []).filter(isImg);
  if (ownerId == null || (photos.length === 0 && menu.length === 0)) return list;
  return list.map(r => r.id !== ownerId ? r : {
    ...r,
    imgs: [...photos.map(f => f.url), ...r.imgs],
    menu: [...menu.map(f => f.url), ...(r.menu || [])],
    ownerPhotoCount: photos.length,
  });
}


export const CATEGORIES = [
  { name:"Türk Mutfağı", img:I.turkish1 }, { name:"Uzak Doğu", img:I.sushi1 },
  { name:"Sağlıklı", img:I.healthy1 }, { name:"Mangal", img:I.bbq1 },
  { name:"Gece Hayatı", img:I.night1 }, { name:"Alkollü", img:I.cocktail1 },
  { name:"Kafe", img:I.cafe1 }, { name:"İtalyan", img:I.pasta1 },
  { name:"Fast Food", img:I.burger1 }, { name:"Tatlıcı", img:I.dessert1 },
  { name:"Deniz Ürünleri", img:I.seafood1 }, { name:"Hint", img:I.curry1 },
  { name:"Fine Dining", img:I.interior2 },
];

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// CANLI VERİ — OpenStreetMap Overpass API (ücretsiz, key gerektirmez)
// Gerçek İstanbul restoranlarını çeker; başarısız olursa mock veriye düşer
// ═══════════════════════════════════════════════
export const CAT_MAP = {
  turkish: "Türk Mutfağı", kebab: "Türk Mutfağı", regional: "Türk Mutfağı",
  japanese: "Uzak Doğu", sushi: "Uzak Doğu", chinese: "Uzak Doğu", asian: "Uzak Doğu", thai: "Uzak Doğu", korean: "Uzak Doğu", vietnamese: "Uzak Doğu", ramen: "Uzak Doğu",
  italian: "İtalyan", pizza: "İtalyan", pasta: "İtalyan",
  burger: "Fast Food", fast_food: "Fast Food", sandwich: "Fast Food", chicken: "Fast Food",
  seafood: "Deniz Ürünleri", fish: "Deniz Ürünleri",
  coffee_shop: "Kafe", cafe: "Kafe", breakfast: "Kafe",
  dessert: "Tatlıcı", ice_cream: "Tatlıcı", cake: "Tatlıcı", baklava: "Tatlıcı",
  indian: "Hint", curry: "Hint",
  vegetarian: "Sağlıklı", vegan: "Sağlıklı", salad: "Sağlıklı",
  barbecue: "Mangal", grill: "Mangal", steak_house: "Mangal",
  bar: "Gece Hayatı", pub: "Gece Hayatı",
};

export function osmToRestaurant(el, idx) {
  const t = el.tags || {};
  const cuisineRaw = (t.cuisine || "").split(";")[0].trim().toLowerCase();
  const cat = CAT_MAP[cuisineRaw] || "Türk Mutfağı";
  const seed = `osm-${el.id}`;
  const streetAddr = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" No:");
  return {
    id: `osm-${el.id}`,
    name: t.name,
    cat,
    rating: (3.8 + ((el.id % 12) / 10)).toFixed(1) * 1, // 3.8 - 4.9 arası deterministik
    dist: `${(0.3 + (el.id % 70) / 10).toFixed(1)} km`,
    price: ["₺150+", "₺300+", "₺500+", "₺800+"][el.id % 4],
    addr: streetAddr ? `${streetAddr}, ${t["addr:district"] || "Kadıköy"}, İstanbul` : `${t["addr:district"] || "Kadıköy"}, İstanbul`,
    desc: t.description || `${cat} kategorisinde${cuisineRaw ? ` (${cuisineRaw})` : ""} hizmet veren mekan.`,
    imgs: [
      `https://picsum.photos/seed/${seed}-a/600/400`,
      `https://picsum.photos/seed/${seed}-b/600/400`,
      `https://picsum.photos/seed/${seed}-c/600/400`,
    ],
    menu: [`https://picsum.photos/seed/${seed}-menu/600/900`],
    hours: t.opening_hours ? t.opening_hours.slice(0, 20) : "11:00 - 23:00",
    tags: [cat, cuisineRaw ? cuisineRaw.charAt(0).toUpperCase() + cuisineRaw.slice(1) : "Restoran"].filter((v, i, a) => a.indexOf(v) === i),
    lat: el.lat, lng: el.lon,
    // İletişim: sahiplenmeye davet gönderebilmek için. Google Places
    // API e-posta DÖNDÜRMEZ — böyle bir alanı yok; OSM ise mekanın
    // kendi bildirdiği `email`/`contact:email` etiketini taşıyabiliyor.
    // Etiket yoksa alan boş kalır ve panel bunu açıkça söyler.
    email: t.email || t["contact:email"] || null,
    website: t.website || t["contact:website"] || null,
    phone: t.phone || t["contact:phone"] || null,
    isLive: true, // OSM'den geldiğini işaretle
  };
}

export async function fetchLiveRestaurants() {
  // Kadıköy merkez bölgesi bounding box
  const query = `[out:json][timeout:15];node["amenity"="restaurant"]["name"](40.980,29.015,41.005,29.045);out body 40;`;
  // Sunucu tarafı [timeout:15] yalnızca sorgu süresini sınırlar; bağlantı
  // yanıtsız kalırsa istek sonsuza kadar bekler. İstemci tarafında da kesiyoruz.
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
    signal: AbortSignal.timeout ? AbortSignal.timeout(18000) : undefined,
  });
  if (!res.ok) throw new Error("Overpass hata: " + res.status);
  const data = await res.json();
  const list = (data.elements || [])
    .filter(el => el.tags && el.tags.name)
    .map(osmToRestaurant);
  if (list.length < 5) throw new Error("Yetersiz veri");
  return list;
}

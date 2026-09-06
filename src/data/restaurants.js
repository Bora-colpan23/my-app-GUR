// ═══════════════════════════════════════════════════════════════════════
// MEKAN HAVUZU — üç uygulamanın ortak verisi
//
// Restoran kaydı tüketici uygulamasının malı değil: işletme uygulaması
// hangi mekanı yönettiğini, yönetici paneli hangi mekanı denetlediğini
// aynı listeden okur. Gerçek dağıtımda burası sunucudaki restaurants
// tablosudur; demo modda tohum liste burada duruyor.
// ═══════════════════════════════════════════════════════════════════════

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

export const RESTAURANTS = [
  { id:1, name:"Nusr-Et Steakhouse", cat:"Türk Mutfağı", rating:4.8, dist:"2.3 km", price:"₺2.500+", addr:"Etiler, Nispetiye Cd. No:87, Beşiktaş", desc:"Dünyaca ünlü et restoranı. Özel kesim etler ve eşsiz sunum.", imgs:[I.steak1,I.interior1,I.kebab1], menu:["https://picsum.photos/seed/menu-nusr1/600/900","https://picsum.photos/seed/menu-nusr2/600/900"], hours:"12:00 - 00:00", tags:["Fine Dining","Et"], lat:41.081, lng:29.033, popular:["Tomahawk","Ottoman Steak","Baklava"], gastro:true, gastroChef:'Şef Mehmet Gürs', claimed:true },
  { id:2, name:"Mikla Restaurant", cat:"Fine Dining", rating:4.9, dist:"5.1 km", price:"₺3.000+", addr:"Beyoğlu, Meşrutiyet Cd. No:15", desc:"Skandinav-Türk mutfağı füzyonu. İstanbul manzarası eşliğinde.", imgs:[I.interior2,I.bosphorus,I.wine1], menu:["https://picsum.photos/seed/menu-mikla1/600/900","https://picsum.photos/seed/menu-mikla2/600/900","https://picsum.photos/seed/menu-mikla3/600/900"], hours:"18:00 - 01:00", tags:["Manzara","Romantik"], lat:41.0315, lng:28.976, popular:["Kuzu Sırtı","Deniz Börülcesi","Sakız Dondurması"], claimed:true },
  { id:3, name:"La Sagrata Famila", cat:"Uzak Doğu", rating:4.5, dist:"10 km", price:"₺800+", addr:"Kadıköy, Moda Cd. No:42", desc:"Geleneksel Japon lezzetini taze malzemelerle modern bir dokunuşla sunuyoruz.", imgs:[I.interior3,I.sushi1,I.sushi2], menu:["https://picsum.photos/seed/menu-sagr1/600/900","https://picsum.photos/seed/menu-sagr2/600/900"], hours:"11:00 - 23:00", tags:["Sushi","Japon"], lat:40.987, lng:29.027, popular:["Omakase","Uramaki","Miso Çorbası"], claimed:true },
  { id:4, name:"Green Bowl", cat:"Sağlıklı", rating:4.5, dist:"1.2 km", price:"₺350+", addr:"Şişli, Halaskargazi Cd. No:12", desc:"Organik ve sağlıklı tarifler. Vegan seçenekler.", imgs:[I.healthy1,I.healthy2,I.salad1], menu:["https://picsum.photos/seed/menu-green1/600/900"], hours:"08:00 - 22:00", tags:["Vegan","Organik"], lat:41.0555, lng:28.988, popular:["Acai Bowl","Falafel Tabağı","Yeşil Detoks"] },
  { id:5, name:"Ateş Mangal", cat:"Mangal", rating:4.7, dist:"4.5 km", price:"₺600+", addr:"Üsküdar, Bağlarbaşı Cd. No:88", desc:"Geleneksel odun ateşinde pişen lezzetler.", imgs:[I.bbq1,I.bbq2,I.kebab1], menu:["https://picsum.photos/seed/menu-ates1/600/900","https://picsum.photos/seed/menu-ates2/600/900"], hours:"11:00 - 00:00", tags:["Mangal","Aile"], lat:41.027, lng:29.018, popular:["Adana Kebap","Kuzu Şiş","Künefe"] },
  { id:6, name:"Klein Bistro", cat:"Kafe", rating:4.4, dist:"0.8 km", price:"₺200+", addr:"Beyoğlu, İstiklal Cd. No:156", desc:"Butik kahve ve ev yapımı pastalar.", imgs:[I.cafe1,I.cafe2,I.barista1], menu:["https://picsum.photos/seed/menu-klein1/600/900"], hours:"07:30 - 23:00", tags:["Kahve","Brunch"], lat:41.0345, lng:28.978, popular:["Flat White","Cheesecake","Avokadolu Tost"] },
  { id:7, name:"Lucca Lounge", cat:"Gece Hayatı", rating:4.3, dist:"6.2 km", price:"₺1.200+", addr:"Bebek, Cevdetpaşa Cd. No:51", desc:"Boğaz manzaralı lounge. Canlı DJ.", imgs:[I.night1,I.cocktail1,I.rooftop1], menu:["https://picsum.photos/seed/menu-lucca1/600/900","https://picsum.photos/seed/menu-lucca2/600/900"], hours:"17:00 - 04:00", tags:["Lounge","Kokteyl"], lat:41.077, lng:29.043, popular:["Espresso Martini","Tuna Tartar","Trüf Patates"], claimed:true },
  { id:8, name:"Nonna's Trattoria", cat:"İtalyan", rating:4.6, dist:"3.1 km", price:"₺500+", addr:"Karaköy, Kemankeş Cd. No:29", desc:"Napoli usulü pizza ve makarna.", imgs:[I.pasta1,I.pizza1,I.bread1], menu:["https://picsum.photos/seed/menu-nonna1/600/900","https://picsum.photos/seed/menu-nonna2/600/900","https://picsum.photos/seed/menu-nonna3/600/900"], hours:"12:00 - 23:30", tags:["Pizza","Makarna"], lat:41.0245, lng:28.976, popular:["Margherita","Cacio e Pepe","Tiramisu"] },
  { id:9, name:"Çiya Sofrası", cat:"Türk Mutfağı", rating:4.7, dist:"4.0 km", price:"₺400+", addr:"Kadıköy, Güneşlibahçe Sk. No:43", desc:"Anadolu'nun dört köşesinden geleneksel tarifler.", imgs:[I.turkish1,I.turkish2,I.soup1], menu:["https://picsum.photos/seed/menu-ciya1/600/900","https://picsum.photos/seed/menu-ciya2/600/900"], hours:"11:00 - 22:00", tags:["Geleneksel","Anadolu"], lat:40.9903, lng:29.0264, popular:["Kuzu Kapama","Zeytinyağlılar","İrmik Helvası"], gastro:true, gastroChef:'Şef Didem Şenol', gastroVideo:'https://picsum.photos/seed/ciya-video/900/600', claimed:true },
  { id:10, name:"Mandarin Oriental", cat:"Uzak Doğu", rating:4.8, dist:"5.5 km", price:"₺1.500+", addr:"Kuruçeşme, Muallim Naci Cd.", desc:"Uzak Doğu'nun en rafine lezzetleri.", imgs:[I.dimsum1,I.ramen1,I.interior2], menu:["https://picsum.photos/seed/menu-mand1/600/900","https://picsum.photos/seed/menu-mand2/600/900"], hours:"12:00 - 23:00", tags:["Dim Sum","Ramen"], lat:41.057, lng:29.033, popular:["Peking Ördeği","Dim Sum Tabağı","Tonkotsu Ramen"] },
  { id:11, name:"The Burger Joint", cat:"Fast Food", rating:4.2, dist:"1.5 km", price:"₺250+", addr:"Nişantaşı, Abdi İpekçi Cd. No:22", desc:"El yapımı burgerler ve özel soslar.", imgs:[I.burger1,I.taco1,I.icecream1], menu:["https://picsum.photos/seed/menu-burg1/600/900"], hours:"11:00 - 01:00", tags:["Burger","Casual"], lat:41.048, lng:28.994, popular:["Klasik Cheeseburger","Trüflü Patates","Milkshake"], claimed:true },
  { id:12, name:"Karaköy Güllüoğlu", cat:"Tatlıcı", rating:4.9, dist:"2.8 km", price:"₺150+", addr:"Kemankeş, Mumhane Cd. No:171", desc:"1820'den beri efsanevi baklava.", imgs:[I.dessert1,I.bread1,I.cafe1], menu:["https://picsum.photos/seed/menu-gull1/600/900","https://picsum.photos/seed/menu-gull2/600/900"], hours:"06:00 - 01:00", tags:["Baklava","Tatlı"], lat:41.025, lng:28.977, popular:["Fıstıklı Baklava","Şöbiyet","Kaymaklı Kadayıf"], gastro:true, gastroChef:'Şef Maksut Aşkar', gastroVideo:'https://picsum.photos/seed/gulluoglu-video/900/600', claimed:true },
  { id:13, name:"Balıkçı Sabahattin", cat:"Deniz Ürünleri", rating:4.6, dist:"6.0 km", price:"₺900+", addr:"Sultanahmet, Seyit Hasan Kuyu Sk.", desc:"1927'den beri taze deniz lezzetleri.", imgs:[I.seafood1,I.bosphorus,I.wine1], menu:["https://picsum.photos/seed/menu-bal1/600/900","https://picsum.photos/seed/menu-bal2/600/900","https://picsum.photos/seed/menu-bal3/600/900"], hours:"12:00 - 23:00", tags:["Balık","Tarihi"], lat:41.0055, lng:28.977, popular:["Levrek Buğulama","Ahtapot Izgara","Midye Dolma"] },
  { id:14, name:"Spice Market", cat:"Hint", rating:4.4, dist:"3.8 km", price:"₺450+", addr:"Cihangir, Akarsu Cd. No:15", desc:"Otantik Hint baharat dünyası.", imgs:[I.curry1,I.interior1,I.bread1], menu:["https://picsum.photos/seed/menu-spic1/600/900","https://picsum.photos/seed/menu-spic2/600/900"], hours:"12:00 - 23:00", tags:["Hint","Curry"], lat:41.033, lng:28.983, popular:["Butter Chicken","Lamb Vindaloo","Garlic Naan"] },
  { id:15, name:"Mövenpick Bosphorus", cat:"Fine Dining", rating:4.5, dist:"7.3 km", price:"₺1.800+", addr:"Örnektepe, İstanbul", desc:"Boğaz kenarında muhteşem manzara.", imgs:[I.bosphorus,I.interior3,I.seafood1], menu:["https://picsum.photos/seed/menu-mov1/600/900","https://picsum.photos/seed/menu-mov2/600/900"], hours:"07:00 - 00:00", tags:["Boğaz","Dünya Mutfağı"], lat:41.048, lng:29.011, popular:["Boğaz Kahvaltısı","Levrek Fileto","Çikolatalı Sufle"] },
];

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

// Doyurucu'nun yönettiği restoran. Canlı OSM verisinde id'ler string
// ("osm-123"), demo veride sayı — bu yüzden sabit bir id'ye bağlanmıyoruz.
export function findOwnerRestaurant(list) {
  return list.find(r => /Kadıköy/.test(r.addr || "")) || list[0] || null;
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

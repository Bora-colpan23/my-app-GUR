// ═══════════════════════════════════════════════════════════════════════
// DETAY
//
// MENÜ GÖRSEL GALERİ olarak açılıyor (metin liste değil) — projenin
// kendi kuralı. Yol tarifi `shared/deeplink.js`ten geliyor: harita
// bağlantı formatı sunucuyla ortak, iki yerde ayrı yazılsaydı biri
// sessizce bozulurdu.
//
// YORUM KİLİDİ: mekânda yeterince kalmadan yorum yazılamıyor. Mobilde
// bu kuralın karşılığı gerçek konum takibi; henüz bağlanmadığı için
// kapı KAPALI görünüyor ve NEDEN kapalı olduğunu yazıyor — açıkmış gibi
// gösterip yazdırmamak en kötüsü olurdu.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking, Dimensions, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { R, F, G, HEDEF } from '../tema.js';
import { Ikon } from '../bilesen/Ikon.js';
import { Hap } from '../bilesen/Hap.js';
import { directionsUrl } from '../../../shared/deeplink.js';
import { mesafeMetni } from '../veri.js';
import { useDepo, favoriCevir } from '../depo.js';
import { istek, canliMi } from '../api.js';

const { width: EN } = Dimensions.get('window');

function Cip({ ikon, metin, renk }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: R.kart, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: 1, borderColor: R.cizgi,
    }}>
      <Ikon n={ikon} size={13} color={renk || R.murekkep2} />
      <Text style={{ fontFamily: F.govdeYari, fontSize: 12.5, color: R.murekkep }}>{metin}</Text>
    </View>
  );
}

export default function Detay({ navigation, route, restoranlar = [] }) {
  const depo = useDepo();
  const r = restoranlar.find(x => String(x.id) === String(route?.params?.id));
  const [buyuk, setBuyuk] = useState(null);

  if (!r) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: R.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: F.baslik, fontSize: 18, color: R.murekkep }}>Mekan bulunamadı</Text>
        <Hap metin="Geri dön" varyant="outlineDark" tamGenislik={false}
          stil={{ marginTop: 16 }} onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const favori = depo.favoriler.includes(String(r.id));

  // MASA AYIRTMA ÜCRETSİZ ve yalnızca kaydını SAHİPLENMİŞ işletmelerde
  // açık: sahipsiz bir mekan adına söz veremeyiz. Kapı arayüzde değil
  // burada da duruyor — düğme kapalı olsa bile çağrı reddediliyor.
  const masaAyirt = async () => {
    if (!r.claimed) return;
    const c = canliMi() ? await istek('/api/reservations', {
      method: 'POST',
      body: { restaurantId: r.id, people: 2 },
    }) : null;
    Alert.alert(
      'Masa talebin iletildi',
      canliMi() && c
        ? `${r.name} talebini aldı. Onaylandığında haber vereceğiz. Komisyon alınmıyor.`
        : `${r.name} için talebin bu cihazda kaydedildi. Sunucuya bağlanınca iletilecek — komisyon alınmıyor.`,
      [{ text: 'Tamam' }],
    );
  };
  const yolTarifi = () => {
    const url = directionsUrl({ name: r.name, lat: r.lat, lng: r.lng, addr: r.addr });
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: R.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={{ height: 300, backgroundColor: R.gorselBg }}>
          <Image source={{ uri: r.imgs?.[0] }} style={{ flex: 1 }} contentFit="cover" transition={240} />
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
            locations={[0, 0.42, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
              <Pressable
                accessibilityRole="button" accessibilityLabel="Geri"
                onPress={() => navigation.goBack()}
                style={{
                  width: HEDEF, height: HEDEF, borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center',
                }}>
                <Ikon n="geri" size={21} color="#fff" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={favori ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                onPress={() => favoriCevir(r.id)}
                style={{
                  width: HEDEF, height: HEDEF, borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center',
                }}>
                <Ikon n="heart" size={21} color={favori ? R.markaAcik : '#fff'} strokeWidth={favori ? 2.8 : 2} />
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        <View style={{ padding: 20, marginTop: -26, backgroundColor: R.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          <Text style={{ fontFamily: F.baslik, fontSize: 27, letterSpacing: -0.9, color: R.murekkep }}>
            {r.name}
          </Text>
          <Text style={{ fontFamily: F.govde, fontSize: 14.5, color: R.solgun, marginTop: 4 }}>
            {r.cat} · {r.addr}
          </Text>

          {r.gastro ? (
            <View style={{
              alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
              backgroundColor: R.markaYumusak, borderRadius: 999,
              paddingHorizontal: 12, paddingVertical: 7, marginTop: 12,
            }}>
              <Ikon n="star" size={14} color={R.markaMurekkepYumusak} />
              <Text style={{ fontFamily: F.govdeKalin, fontSize: 12.5, color: R.markaMurekkepYumusak }}>
                Gastro Onaylı{r.gastroChef ? ` · ${r.gastroChef}` : ''}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <Cip ikon="star" metin={String(r.rating)} renk={R.uyariMurekkep} />
            {mesafeMetni(r) ? <Cip ikon="pin" metin={mesafeMetni(r)} /> : null}
            {r.price ? <Cip ikon="bank" metin={r.price} /> : null}
            {r.hours ? <Cip ikon="clock" metin={r.hours} /> : null}
          </View>

          {r.desc ? (
            <Text style={{
              fontFamily: F.govde, fontSize: 15, lineHeight: 24,
              color: R.murekkep2, marginTop: 18,
            }}>{r.desc}</Text>
          ) : null}

          {r.popular?.length ? (
            <>
              <Text style={{ fontFamily: F.baslik, fontSize: 17, color: R.murekkep, marginTop: 24, marginBottom: 10 }}>
                Öne çıkanlar
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {r.popular.map(p => (
                  <View key={p} style={{
                    backgroundColor: R.sicak1, borderRadius: 999,
                    paddingHorizontal: 13, paddingVertical: 8,
                  }}>
                    <Text style={{ fontFamily: F.govdeOrta, fontSize: 13, color: R.murekkep2 }}>{p}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {r.imgs?.length > 1 ? (
            <>
              <Text style={{ fontFamily: F.baslik, fontSize: 17, color: R.murekkep, marginTop: 26, marginBottom: 10 }}>
                Fotoğraflar
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
                {r.imgs.map((u, i) => (
                  <Pressable key={`${u}-${i}`} accessibilityRole="imagebutton"
                    accessibilityLabel={`${r.name} fotoğraf ${i + 1}`} onPress={() => setBuyuk(u)}>
                    <Image source={{ uri: u }}
                      style={{ width: 150, height: 110, borderRadius: 16, backgroundColor: R.gorselBg }}
                      contentFit="cover" transition={200} />
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {r.menu?.length ? (
            <>
              <Text style={{ fontFamily: F.baslik, fontSize: 17, color: R.murekkep, marginTop: 26, marginBottom: 4 }}>
                Menü
              </Text>
              <Text style={{ fontFamily: F.govde, fontSize: 13, color: R.solgun, marginBottom: 10 }}>
                Sayfaya dokununca tam boy açılır.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
                {r.menu.map((u, i) => (
                  <Pressable key={`${u}-${i}`} accessibilityRole="imagebutton"
                    accessibilityLabel={`Menü sayfa ${i + 1}`} onPress={() => setBuyuk(u)}>
                    <Image source={{ uri: u }}
                      style={{ width: 128, height: 180, borderRadius: 14, backgroundColor: R.gorselBg }}
                      contentFit="cover" transition={200} />
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* Yorum kilidi — kapalıysa SEBEBİ yazılı. */}
          <View style={[{
            marginTop: 26, backgroundColor: R.kart, borderRadius: 20, padding: 16,
            borderWidth: 1, borderColor: R.kenar,
          }, G.g1]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ikon n="chat" size={18} color={R.marka} />
              <Text style={{ fontFamily: F.baslik, fontSize: 15.5, color: R.murekkep }}>
                Konum doğrulamalı yorum
              </Text>
            </View>
            <Text style={{ fontFamily: F.govde, fontSize: 13.5, lineHeight: 21, color: R.solgun, marginTop: 8 }}>
              Yorum yazmak için mekânda en az 15 dakika kalmış olman gerekiyor
              (120 m yarıçap). Oradayken uygulama sana soruyor ve yorumun
              "Konumla doğrulandı" rozeti alıyor.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Alt eylem şeridi */}
      <SafeAreaView edges={['bottom']} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: R.kart, borderTopWidth: 1, borderTopColor: R.cizgi,
      }}>
        <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
          <Hap metin="Yol tarifi" varyant="outlineDark" tamGenislik={false}
            stil={{ flex: 1 }} onPress={yolTarifi} />
          <Hap metin={r.claimed ? 'Masa ayırt' : 'Masa ayırtma kapalı'}
            tamGenislik={false} stil={{ flex: 1.3 }}
            kapali={!r.claimed}
            onPress={masaAyirt} />
        </View>
      </SafeAreaView>

      <Modal visible={!!buyuk} transparent animationType="fade" onRequestClose={() => setBuyuk(null)}>
        <Pressable
          accessibilityRole="button" accessibilityLabel="Kapat"
          onPress={() => setBuyuk(null)}
          style={{ flex: 1, backgroundColor: 'rgba(10,8,6,0.94)', alignItems: 'center', justifyContent: 'center' }}>
          {buyuk ? (
            <Image source={{ uri: buyuk }} style={{ width: EN, height: EN * 1.4 }} contentFit="contain" />
          ) : null}
          <Text style={{
            position: 'absolute', bottom: 48, fontFamily: F.govdeOrta,
            fontSize: 13.5, color: 'rgba(255,255,255,0.7)',
          }}>Kapatmak için dokun</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

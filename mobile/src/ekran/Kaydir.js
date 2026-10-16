// ═══════════════════════════════════════════════════════════════════════
// KAYDIR — deste
//
// Kartın kendisi KaydirmaKarti'nda; burası destenin kurgusu. Sponsorlu
// kartlar organik akışa `shared/deck.js` ile harmanlanıyor (sunucuyla
// ORTAK fonksiyon) ve kart tipine göre ayrı bir bileşen yok: sponsorlu
// kart organik kartla aynı nesne, yalnızca küçük bir rozet taşıyor.
//
// Düğmelerde renk AYRIM TAŞIMIYOR, ŞEKİL taşıyor: çarpı = geç,
// çift ok = detay, kalp = kaydet. Üçü de marka turuncusu.
// ═══════════════════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { R, F, G, HEDEF } from '../tema.js';
import { Ikon } from '../bilesen/Ikon.js';
import { Hap } from '../bilesen/Hap.js';
import { KaydirmaKarti } from '../bilesen/KaydirmaKarti.js';
import { desteKur } from '../veri.js';
import { useDepo, favoriCevir, gecildi, superBegenildi } from '../depo.js';

const { height: BOY } = Dimensions.get('window');

function YuvarlakDugme({ ikon, onPress, buyuk = false, etiket }) {
  const d = buyuk ? 68 : 56;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiket}
      onPress={onPress}
      style={({ pressed }) => [{
        width: d, height: d, borderRadius: 999, backgroundColor: R.kart,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: R.kenar,
        transform: [{ scale: pressed ? 0.93 : 1 }],
      }, G.g2]}>
      <Ikon n={ikon} size={buyuk ? 28 : 23} color={R.marka} strokeWidth={2.4} />
    </Pressable>
  );
}

export default function Kaydir({ navigation, restoranlar = [] }) {
  const depo = useDepo();
  const [sayac, setSayac] = useState(0);      // kaç karar verildi
  const [tur, setTur] = useState(0);          // "geçtiklerine bir daha bak" turu

  // Deste oturum başında kuruluyor ve KARAR VERİLDİKÇE kaymıyor:
  // canlı hesaplansaydı kart en üste gelir, gösterim kaydedilir, depo
  // değişir ve kart kullanıcı görmeden listeden düşerdi.
  const deste = useMemo(
    () => desteKur(restoranlar, { gecilen: tur === 0 ? depo.gecilen : [], tohum: tur + 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restoranlar, tur],
  );

  const kalan = deste.slice(sayac);
  const bitti = kalan.length === 0;

  const karar = useCallback((yon, r) => {
    if (yon === 'sag') favoriCevir(r.id);
    else if (yon === 'sol') gecildi(r.id);
    else if (yon === 'yukari') superBegenildi(r.id);
    setSayac(s => s + 1);
  }, []);

  const dugmeyle = (yon) => {
    const r = kalan[0];
    if (!r) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    karar(yon, r);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: R.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 }}>
        <Text style={{ fontFamily: F.baslik, fontSize: 24, letterSpacing: -0.7, color: R.murekkep }}>
          Kaydırarak keşfet
        </Text>
        <Text style={{ fontFamily: F.govde, fontSize: 13.5, color: R.solgun, marginTop: 3 }}>
          Sağa kaydet · sola geç · yukarı bu akşam
        </Text>
      </View>

      <View style={{ flex: 1, marginHorizontal: 14, marginBottom: 8, minHeight: BOY * 0.46 }}>
        {bitti ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
            <View style={{
              width: 66, height: 66, borderRadius: 999, backgroundColor: R.markaYumusak,
              alignItems: 'center', justifyContent: 'center', marginBottom: 18,
            }}>
              <Ikon n="brokenHeart" size={28} color={R.marka} />
            </View>
            <Text style={{ fontFamily: F.baslik, fontSize: 21, color: R.murekkep, textAlign: 'center' }}>
              Deste bitti
            </Text>
            <Text style={{
              fontFamily: F.govde, fontSize: 14.5, color: R.solgun,
              textAlign: 'center', marginTop: 8, lineHeight: 22,
            }}>
              {depo.gecilen.length
                ? 'Geçtiklerine bir daha bakmak ister misin? Bu tur ücretsiz.'
                : 'Bugünlük bu kadar. Favorilerine göz atabilirsin.'}
            </Text>
            <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 22 }}>
              {depo.gecilen.length ? (
                <Hap metin="Geçtiklerine bir daha bak"
                  onPress={() => { setTur(t => t + 1); setSayac(0); }} />
              ) : null}
              <Hap metin="Favorilerim" varyant="outlineDark"
                onPress={() => navigation.navigate('Favoriler')} />
            </View>
          </View>
        ) : (
          // Yalnızca üç kart çiziliyor: arkadakiler görünmüyor ve her
          // kartın kendi gesture'ı var; hepsini basmak elli düğümlük
          // bir ağaç demekti.
          kalan.slice(0, 3).reverse().map((r, i, a) => {
            const derinlik = a.length - 1 - i;
            return (
              <KaydirmaKarti
                key={`${tur}-${r.id}`}
                r={r}
                derinlik={derinlik}
                ustte={derinlik === 0}
                onKarar={karar}
                onDetay={() => navigation.navigate('detay', { id: r.id })}
              />
            );
          })
        )}
      </View>

      {!bitti ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          gap: 18, paddingBottom: 10, minHeight: HEDEF + 24,
        }}>
          <YuvarlakDugme ikon="cross" etiket="Geç" onPress={() => dugmeyle('sol')} />
          <YuvarlakDugme ikon="sparkle" etiket="Bu akşam buradayım" buyuk onPress={() => dugmeyle('yukari')} />
          <YuvarlakDugme ikon="heart" etiket="Kaydet" onPress={() => dugmeyle('sag')} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PROFİL — hesap, rıza ve mod
//
// KARANLIK KALIP YOK: hesap silme TEK ONAYLA ulaşılabiliyor (roach motel
// yok) ve rızayı geri almak vermek kadar kolay. Hangi modda çalışıldığı
// da gizlenmiyor: yerel modda yazılanlar yalnızca bu cihazda kalıyor,
// bunu söylemek dürüstlük.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { R, F, G, HEDEF } from '../tema.js';
import { Ikon } from '../bilesen/Ikon.js';
import { Hap } from '../bilesen/Hap.js';
import { useDepo, yaz } from '../depo.js';
import { apiModu, sunucuBilgisi, cikisYap } from '../api.js';
import { hesabiSil as hesabiSilSunucuyla, rizaKarari } from '../senkron.js';
import { LEGAL } from '../../../shared/legal.js';

function Satir({ ikon, baslik, deger, onPress, son }) {
  const ic = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 13,
      paddingVertical: 14, minHeight: HEDEF,
      borderBottomWidth: son ? 0 : 1, borderBottomColor: R.cizgi,
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: 999, backgroundColor: R.markaYumusak,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ikon n={ikon} size={16} color={R.marka} />
      </View>
      <Text style={{ flex: 1, fontFamily: F.govdeYari, fontSize: 15, color: R.murekkep }}>{baslik}</Text>
      {deger ? <Text style={{ fontFamily: F.govde, fontSize: 14, color: R.solgun }}>{deger}</Text> : null}
      {onPress ? <Ikon n="ok" size={16} color={R.sicak4} /> : null}
    </View>
  );
  if (!onPress) return ic;
  return <Pressable accessibilityRole="button" onPress={onPress}>{ic}</Pressable>;
}

export default function Profil({ navigation }) {
  const depo = useDepo();
  const [mod] = useState(apiModu());
  const yorumSayisi = Object.values(depo.yorumlar).reduce((t, l) => t + l.length, 0);

  const cikis = () => {
    Alert.alert('Çıkış yapılsın mı?', 'Favorilerin bu cihazda kalır.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkış yap',
        style: 'destructive',
        onPress: async () => {
          await cikisYap();
          yaz({ kullanici: null });
          navigation.getParent()?.reset({ index: 0, routes: [{ name: 'karsilama' }] });
        },
      },
    ]);
  };

  const hesabiSil = () => {
    Alert.alert(
      'Hesabın silinsin mi?',
      'Hesabın, favorilerin, yorumların ve tercihlerin kalıcı olarak silinir. Geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            // Sunucu silemezse yerel veri de SİLİNMEZ: yarım silme, kullanıcıya
            // "silindi" deyip hesabı sunucuda bırakmak olurdu.
            const s = await hesabiSilSunucuyla();
            if (s.hata) { Alert.alert('Hesap silinemedi', s.hata, [{ text: 'Tamam' }]); return; }
            navigation.getParent()?.reset({ index: 0, routes: [{ name: 'karsilama' }] });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: R.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text style={{ fontFamily: F.baslik, fontSize: 24, letterSpacing: -0.7, color: R.murekkep }}>
          Profil
        </Text>

        <View style={[{
          flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18,
          backgroundColor: R.kart, borderRadius: 22, padding: 16,
          borderWidth: 1, borderColor: R.kenar,
        }, G.g1]}>
          <View style={{
            width: 54, height: 54, borderRadius: 999, backgroundColor: R.markaYumusak,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: F.baslik, fontSize: 22, color: R.markaMurekkepYumusak }}>
              {(depo.kullanici?.ad || 'G').slice(0, 1).toLocaleUpperCase('tr')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.baslik, fontSize: 18, color: R.murekkep }}>
              {depo.kullanici?.ad || 'Misafir'}
            </Text>
            <Text style={{ fontFamily: F.govde, fontSize: 13.5, color: R.solgun, marginTop: 2 }}>
              {depo.kullanici?.email || 'Giriş yapılmadı'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          {[['Favori', depo.favoriler.length], ['Bu akşam', depo.superBegeni.length], ['Yorum', yorumSayisi]].map(([b, s]) => (
            <View key={b} style={[{
              flex: 1, backgroundColor: R.kart, borderRadius: 18, padding: 14,
              borderWidth: 1, borderColor: R.kenar, alignItems: 'center',
            }, G.g1]}>
              <Text style={{ fontFamily: F.baslik, fontSize: 22, color: R.murekkep }}>{s}</Text>
              <Text style={{ fontFamily: F.govde, fontSize: 12, color: R.solgun, marginTop: 2 }}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={[{
          marginTop: 18, backgroundColor: R.kart, borderRadius: 22,
          paddingHorizontal: 16, borderWidth: 1, borderColor: R.kenar,
        }, G.g1]}>
          <Satir ikon="pin" baslik="Konum"
            deger={depo.konum ? (depo.konum.ilce || 'Cihazdan') : 'Kapalı'}
            onPress={() => navigation.navigate('konumDegis')} />
          <Satir ikon="shield" baslik="Ölçümleme izni"
            deger={depo.riza === 'kabul' ? 'Açık' : 'Kapalı'}
            onPress={() => rizaKarari(depo.riza === 'kabul' ? 'ret' : 'kabul')} />
          <Satir ikon="chart" baslik="Bağlantı"
            deger={mod === 'canli' ? `Canlı · ${sunucuBilgisi()?.restaurants ?? ''}` : 'Yerel'} son />
        </View>

        {/* Yasal metinler ve destek: mağaza gereksinimi (gizlilik politikasına
            uygulama İÇİNDEN ulaşılmalı; içerik/hesap bildirimi için iletişim yolu). */}
        <View style={[{
          marginTop: 14, backgroundColor: R.kart, borderRadius: 22,
          paddingHorizontal: 16, borderWidth: 1, borderColor: R.kenar,
        }, G.g1]}>
          <Satir ikon="shield" baslik="Gizlilik politikası"
            onPress={() => navigation.navigate('yasal', { doc: 'privacy' })} />
          <Satir ikon="doc" baslik="Kullanım koşulları"
            onPress={() => navigation.navigate('yasal', { doc: 'terms' })} />
          <Satir ikon="doc" baslik="KVKK aydınlatma metni"
            onPress={() => navigation.navigate('yasal', { doc: 'kvkk' })} />
          <Satir ikon="chat" baslik="Destek ve içerik bildirimi" deger={LEGAL.destek}
            onPress={() => Linking.openURL(`mailto:${LEGAL.destek}`)} son />
        </View>

        {/* Yerel mod GİZLENMİYOR: ne olduğunu yazıyoruz. */}
        {mod !== 'canli' ? (
          <Text style={{
            fontFamily: F.govde, fontSize: 12.5, color: R.solgun,
            lineHeight: 19, marginTop: 10, paddingHorizontal: 4,
          }}>
            Sunucuya ulaşılamıyor. Uygulama yerel modda çalışıyor: favorilerin
            ve yorumların yalnızca bu cihazda saklanıyor.
          </Text>
        ) : null}

        <View style={{ gap: 10, marginTop: 22 }}>
          <Hap metin="Çıkış yap" varyant="outlineDark" onPress={cikis} />
          <Pressable
            accessibilityRole="button"
            onPress={hesabiSil}
            style={{ minHeight: HEDEF, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.govdeYari, fontSize: 14, color: R.olumsuzMurekkep }}>
              Hesabımı sil
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

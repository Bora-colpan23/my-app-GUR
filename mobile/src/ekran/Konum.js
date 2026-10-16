// ═══════════════════════════════════════════════════════════════════════
// KONUM — üç yol da EŞİT AĞIRLIKTA (karanlık kalıp yok)
//
// Tarayıcı/işletim sistemi izin kutusu habersiz açılmasın diye niyet
// önce yazıyla anlatılıyor. Üç seçeneğin üçü de aynı boy ve punto;
// ayrım yalnızca varyantta. Web tarafında bir dönem "Şimdi değil"
// 341×35 / 12.5 punto idi — hem karanlık kalıp hem 44'ün altında hedef.
//
// Adım göstergesi YALNIZCA kayıttan gelindiğinde: girişten gelen
// kullanıcı için bu tek ekranlık bir soru, "1/1" yazan bir çubuk bilgi
// değil gürültü olurdu.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { R, F, G, HEDEF } from '../tema.js';
import { Ikon } from '../bilesen/Ikon.js';
import { Hap } from '../bilesen/Hap.js';
import { yaz } from '../depo.js';
import { cihazKonumu, ilceSec, ILCELER } from '../konum.js';

export default function Konum({ navigation, route }) {
  const kayittan = !!route?.params?.kayittan;
  const [liste, setListe] = useState(false);
  const [bekle, setBekle] = useState(false);

  const bitir = (konum) => {
    yaz({ konum });
    navigation.reset({ index: 0, routes: [{ name: 'sekmeler' }] });
  };

  const cihaz = async () => {
    setBekle(true);
    const k = await cihazKonumu();
    setBekle(false);
    // İzin reddedilirse AKIŞ TIKANMIYOR: elle seçim listesi açılıyor.
    if (k) bitir(k); else setListe(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: R.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32, flexGrow: 1 }}>
        {kayittan ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Adım 2 / 2"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 26 }}>
            <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: R.marka }} />
            <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: R.marka }} />
            <Text style={{ fontFamily: F.govdeKalin, fontSize: 12, color: R.solgun }}>2/2</Text>
          </View>
        ) : <View style={{ height: 12 }} />}

        <View style={{
          width: 64, height: 64, borderRadius: 999, backgroundColor: R.markaYumusak,
          alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Ikon n="pin" size={28} color={R.marka} />
        </View>

        <Text style={{ fontFamily: F.baslik, fontSize: 28, lineHeight: 34, letterSpacing: -0.9, color: R.murekkep }}>
          Nerede yemek arıyorsun?
        </Text>
        <Text style={{ fontFamily: F.govde, fontSize: 15, lineHeight: 24, color: R.solgun, marginTop: 10 }}>
          Yakınındaki mekanları önce göstermek için konumunu kullanabiliriz.
          Ham koordinatın hiçbir yere gönderilmiyor — mesafe cihazında
          hesaplanıyor.
        </Text>

        {liste ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontFamily: F.govdeKalin, fontSize: 13, color: R.murekkep2, marginBottom: 10 }}>
              İlçeni seç
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ILCELER.map(i => (
                <Pressable
                  key={i.ad}
                  accessibilityRole="button"
                  onPress={() => bitir(ilceSec(i.ad))}
                  style={[{
                    minHeight: HEDEF, justifyContent: 'center',
                    paddingHorizontal: 16, borderRadius: 999,
                    backgroundColor: R.kart, borderWidth: 1, borderColor: R.cizgi,
                  }, G.g1]}>
                  <Text style={{ fontFamily: F.govdeYari, fontSize: 14.5, color: R.murekkep }}>{i.ad}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        <View style={{ gap: 10, marginTop: 28 }}>
          <Hap metin="Konumumu kullan" onPress={cihaz} yukleniyor={bekle} />
          <Hap metin="İlçemi seçeyim" varyant="outlineDark" onPress={() => setListe(true)} />
          {/* Üçüncü yol da AYNI BOY ve puntoda: reddetmek kabul etmek
              kadar kolay olmalı. */}
          <Hap metin="Şimdi değil" varyant="outlineDark" onPress={() => bitir(null)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

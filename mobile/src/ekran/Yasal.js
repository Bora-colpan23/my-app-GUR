// ═══════════════════════════════════════════════════════════════════════
// YASAL METİNLER — uygulamanın İÇİNDE okunur
//
// Apple (5.1.1) ve Google Play, gizlilik politikasına uygulama içinden
// ulaşılmasını ister; kayıt ekranındaki "kabul ediyorum" da okunabilir bir
// metne bağlı olmalı (okunamayan bir metni onaylatmak onay sayılmaz).
// Metin shared/legal.js'ten gelir: web sitesi, web uygulaması ve mağaza
// formlarıyla AYNI — üçü ayrı yazılsa biri uygulamanın yaptığından sapardı.
//
// Alan adından BAĞIMSIZ: metin pakette olduğu için site yokken de açılır.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { R, F, HEDEF } from '../tema.js';
import { Ikon } from '../bilesen/Ikon.js';
import { LEGAL, LEGAL_DOCS } from '../../../shared/legal.js';

export default function Yasal({ navigation, route }) {
  const [id, setId] = useState(route?.params?.doc || 'privacy');
  const doc = LEGAL_DOCS.find(d => d.id === id) || LEGAL_DOCS[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: R.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6 }}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button" accessibilityLabel="Geri"
          style={{ width: HEDEF, height: HEDEF, alignItems: 'center', justifyContent: 'center' }}>
          <Ikon n="geri" size={22} color={R.murekkep} />
        </Pressable>
        <Text accessibilityRole="header" style={{ fontFamily: F.baslik, fontSize: 20, color: R.murekkep }}>
          Yasal metinler
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 6 }}>
        {LEGAL_DOCS.map(d => {
          const sec = d.id === id;
          return (
            <Pressable
              key={d.id} onPress={() => setId(d.id)}
              accessibilityRole="tab" accessibilityState={{ selected: sec }}
              style={{
                minHeight: HEDEF, paddingHorizontal: 16, borderRadius: 999,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: sec ? R.marka : R.kart,
                borderWidth: sec ? 0 : 1, borderColor: R.kenar,
              }}>
              <Text style={{ fontFamily: F.govdeKalin, fontSize: 13.5, color: sec ? R.uzeriMarka : R.murekkep2 }}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text accessibilityRole="header" style={{ fontFamily: F.baslik, fontSize: 22, color: R.murekkep, lineHeight: 28 }}>
          {doc.title}
        </Text>
        <Text style={{ fontFamily: F.govde, fontSize: 12.5, color: R.solgun, marginTop: 6, marginBottom: 10 }}>
          {LEGAL.unvan} · Son güncelleme {LEGAL.guncelleme}
        </Text>
        {doc.body.map(([baslik, metin]) => (
          <View key={baslik} style={{ marginTop: 14 }}>
            <Text accessibilityRole="header" style={{ fontFamily: F.govdeKalin, fontSize: 15.5, color: R.murekkep }}>{baslik}</Text>
            <Text style={{ fontFamily: F.govde, fontSize: 14.5, color: R.murekkep2, lineHeight: 22, marginTop: 4 }}>{metin}</Text>
          </View>
        ))}

        <Pressable
          onPress={() => Linking.openURL(`mailto:${LEGAL.destek}`)}
          accessibilityRole="link"
          style={{ minHeight: HEDEF, justifyContent: 'center', marginTop: 22 }}>
          <Text style={{ fontFamily: F.govdeKalin, fontSize: 14.5, color: R.markaMurekkep }}>
            Soru ve bildirimler: {LEGAL.destek}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

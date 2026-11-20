// Karşılama: ne olduğunu bir cümlede söyleyip iki yol gösteriyor.
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { R, F, GRADYAN, G } from '../tema.js';
import { Logo } from '../bilesen/Logo.js';
import { Ikon } from '../bilesen/Ikon.js';
import { Hap } from '../bilesen/Hap.js';
import { TOHUM } from '../veri.js';

const YOLLAR = [
  { i: 'heart', b: 'Sağa kaydır', a: 'Beğendiğini kaydet' },
  { i: 'cross', b: 'Sola kaydır', a: 'İlgilenmediğini geç' },
  { i: 'sparkle', b: 'Yukarı kaydır', a: 'Bu akşam buradayım' },
];

export default function Karsilama({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: R.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32, flexGrow: 1 }}>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Logo size={46} />
        </View>

        <View style={{ height: 210, borderRadius: 26, overflow: 'hidden', marginTop: 26, backgroundColor: R.gorselBg }}>
          <Image source={{ uri: TOHUM[0]?.imgs?.[0] }} style={{ flex: 1 }} contentFit="cover" transition={240} />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }}
          />
        </View>

        <Text style={{
          fontFamily: F.baslik, fontSize: 32, lineHeight: 37, letterSpacing: -1,
          color: R.murekkep, marginTop: 26,
        }}>
          Hoş geldin!
        </Text>
        <Text style={{
          fontFamily: F.govde, fontSize: 16, lineHeight: 25, color: R.solgun, marginTop: 10,
        }}>
          İstanbul'un restoranlarını kaydırarak keşfet. Beğendiğini kaydet,
          bu akşam gideceğini yukarı kaydır.
        </Text>

        <View style={{ marginTop: 24, gap: 10 }}>
          {YOLLAR.map(y => (
            <View key={y.b} style={[{
              flexDirection: 'row', alignItems: 'center', gap: 13,
              backgroundColor: R.kart, borderRadius: 18, padding: 14,
              borderWidth: 1, borderColor: R.kenar,
            }, G.g1]}>
              <View style={{
                width: 38, height: 38, borderRadius: 999, backgroundColor: R.markaYumusak,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ikon n={y.i} size={17} color={R.marka} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.govdeKalin, fontSize: 15, color: R.murekkep }}>{y.b}</Text>
                <Text style={{ fontFamily: F.govde, fontSize: 13, color: R.solgun, marginTop: 1 }}>{y.a}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ marginTop: 28, gap: 10 }}>
          <Hap metin="GUR'u kullanmaya başla" onPress={() => navigation.navigate('giris', { kayit: false })} />
          <Hap metin="Hesabım yok, kayıt olayım" varyant="outlineDark"
            onPress={() => navigation.navigate('giris', { kayit: true })} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Favoriler — boş durumu var ve çıkış yolu gösteriyor.
import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { R, F, G, HEDEF } from '../tema.js';
import { Ikon } from '../bilesen/Ikon.js';
import { Hap } from '../bilesen/Hap.js';
import { useDepo, favoriCevir } from '../depo.js';
import { mesafeMetni } from '../veri.js';

export default function Favoriler({ navigation, restoranlar = [] }) {
  const depo = useDepo();
  const liste = depo.favoriler
    .map(id => restoranlar.find(r => String(r.id) === id))
    .filter(Boolean);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: R.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 }}>
        <Text style={{ fontFamily: F.baslik, fontSize: 24, letterSpacing: -0.7, color: R.murekkep }}>
          Favorilerim
        </Text>
        <Text style={{ fontFamily: F.govde, fontSize: 13.5, color: R.solgun, marginTop: 3 }}>
          {liste.length ? `${liste.length} mekan kayıtlı` : 'Henüz kayıtlı mekan yok'}
        </Text>
      </View>

      {liste.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 999, backgroundColor: R.markaYumusak,
            alignItems: 'center', justifyContent: 'center', marginBottom: 18,
          }}>
            <Ikon n="heart" size={28} color={R.marka} />
          </View>
          <Text style={{ fontFamily: F.baslik, fontSize: 20, color: R.murekkep, textAlign: 'center' }}>
            Kaydettiklerin burada
          </Text>
          <Text style={{
            fontFamily: F.govde, fontSize: 14.5, color: R.solgun,
            textAlign: 'center', marginTop: 8, lineHeight: 22,
          }}>
            Kaydırırken sağa attığın her mekan bu listeye düşüyor.
          </Text>
          <Hap metin="Kaydırmaya başla" stil={{ marginTop: 22, alignSelf: 'stretch' }}
            onPress={() => navigation.navigate('Kaydır')} />
        </View>
      ) : (
        <FlatList
          data={liste}
          keyExtractor={r => String(r.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          renderItem={({ item: r }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={r.name}
              onPress={() => navigation.navigate('detay', { id: r.id })}
              style={({ pressed }) => [{
                flexDirection: 'row', gap: 13, padding: 10, marginBottom: 12,
                backgroundColor: R.kart, borderRadius: 20, borderWidth: 1, borderColor: R.kenar,
                transform: [{ translateY: pressed ? 1 : 0 }, { scale: pressed ? 0.988 : 1 }],
              }, G.g1]}>
              <Image source={{ uri: r.imgs?.[0] }}
                style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: R.gorselBg }}
                contentFit="cover" transition={200} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text numberOfLines={1} style={{ fontFamily: F.baslik, fontSize: 16, color: R.murekkep }}>{r.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: F.govde, fontSize: 13, color: R.solgun, marginTop: 2 }}>
                  {r.cat} · {mesafeMetni(r)}
                </Text>
                {depo.superBegeni.includes(String(r.id)) ? (
                  <View style={{
                    alignSelf: 'flex-start', marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: R.markaYumusak, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
                  }}>
                    <Ikon n="sparkle" size={11} color={R.markaMurekkepYumusak} />
                    <Text style={{ fontFamily: F.govdeKalin, fontSize: 10.5, color: R.markaMurekkepYumusak }}>
                      BU AKŞAM
                    </Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Favorilerden çıkar"
                hitSlop={10}
                onPress={() => favoriCevir(r.id)}
                style={{ width: HEDEF, height: HEDEF, alignItems: 'center', justifyContent: 'center' }}>
                <Ikon n="heart" size={20} color={R.marka} strokeWidth={2.6} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

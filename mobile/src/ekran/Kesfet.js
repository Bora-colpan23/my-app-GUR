// ═══════════════════════════════════════════════════════════════════════
// KEŞFET — liste, arama, kategoriler
//
// BOŞ DURUM VAR. Havuz boş kaldığında (besleme dönmedi, hepsi gizlendi)
// ekran yine çizilip kategorileri "0" göstermiyor: ne olduğunu yazıyor
// ve iki yol gösteriyor. Kullanıcı uygulamanın bozuk olduğunu sanmasın.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { R, F, G, HEDEF } from '../tema.js';
import { Ikon } from '../bilesen/Ikon.js';
import { Hap } from '../bilesen/Hap.js';
import { KonumCipi } from '../bilesen/KonumCipi.js';
import { Logo } from '../bilesen/Logo.js';
import { CATEGORIES, mesafeMetni } from '../veri.js';
import { useDepo, favoriCevir } from '../depo.js';

function Satir({ r, onPress, favori, onFavori }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.name}, ${r.cat}, puan ${r.rating}`}
      onPress={() => onPress(r)}
      style={({ pressed }) => [{
        flexDirection: 'row', gap: 13, padding: 10, marginBottom: 12,
        backgroundColor: R.kart, borderRadius: 20, borderWidth: 1, borderColor: R.kenar,
        transform: [{ scale: pressed ? 0.988 : 1 }, { translateY: pressed ? 1 : 0 }],
      }, G.g1]}>
      <Image source={{ uri: r.imgs?.[0] }} style={{ width: 92, height: 92, borderRadius: 14, backgroundColor: R.gorselBg }}
        contentFit="cover" transition={200} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.baslik, fontSize: 16.5, color: R.murekkep, letterSpacing: -0.3 }}>
            {r.name}
          </Text>
          {r.gastro ? <Ikon n="star" size={14} color={R.marka} /> : null}
        </View>
        <Text numberOfLines={1} style={{ fontFamily: F.govde, fontSize: 13, color: R.solgun, marginTop: 2 }}>
          {r.cat}{r.price ? ` · ${r.price}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ikon n="star" size={12} color={R.uyariMurekkep} />
            <Text style={{ fontFamily: F.govdeKalin, fontSize: 12.5, color: R.murekkep2 }}>{r.rating}</Text>
          </View>
          {mesafeMetni(r) ? (
            <Text style={{ fontFamily: F.govde, fontSize: 12.5, color: R.solgun }}>{mesafeMetni(r)}</Text>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favori ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        onPress={() => onFavori(r.id)}
        hitSlop={10}
        style={{ width: HEDEF, height: HEDEF, alignItems: 'center', justifyContent: 'center' }}>
        <Ikon n="heart" size={20} color={favori ? R.marka : R.sicak4} strokeWidth={favori ? 2.6 : 2} />
      </Pressable>
    </Pressable>
  );
}

export default function Kesfet({ navigation, route, restoranlar = [], onKonum }) {
  const depo = useDepo();
  const [arama, setArama] = useState('');
  const [kategori, setKategori] = useState(null);

  const liste = useMemo(() => {
    const a = arama.trim().toLocaleLowerCase('tr');
    return restoranlar.filter(r => {
      if (kategori && r.cat !== kategori) return false;
      if (!a) return true;
      return `${r.name} ${r.cat} ${(r.tags || []).join(' ')}`.toLocaleLowerCase('tr').includes(a);
    });
  }, [restoranlar, arama, kategori]);

  const bos = restoranlar.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: R.bg }} edges={['top']}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 4,
      }}>
        <KonumCipi konum={depo.konum} onPress={onKonum} />
        <Logo size={26} />
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: R.kart, borderRadius: 999, paddingHorizontal: 16,
          minHeight: 48, borderWidth: 1, borderColor: R.cizgi,
        }}>
          <Ikon n="search" size={17} color={R.solgun} />
          <TextInput
            accessibilityLabel="Restoran ara"
            value={arama}
            onChangeText={setArama}
            placeholder="Restoran, mutfak ya da semt"
            placeholderTextColor={R.solgun}
            style={{ flex: 1, fontFamily: F.govde, fontSize: 16, color: R.murekkep, paddingVertical: 10 }}
          />
        </View>
      </View>

      {bos ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 999, backgroundColor: R.markaYumusak,
            alignItems: 'center', justifyContent: 'center', marginBottom: 18,
          }}>
            <Ikon n="plate" size={28} color={R.marka} />
          </View>
          <Text style={{ fontFamily: F.baslik, fontSize: 21, color: R.murekkep, textAlign: 'center' }}>
            Burada henüz mekan yok
          </Text>
          <Text style={{
            fontFamily: F.govde, fontSize: 14.5, color: R.solgun, textAlign: 'center',
            marginTop: 8, lineHeight: 22,
          }}>
            Seçtiğin bölgede gösterilecek kayıt bulunamadı. Konumunu
            değiştirebilir ya da favorilerine bakabilirsin.
          </Text>
          <View style={{ gap: 10, marginTop: 22, alignSelf: 'stretch' }}>
            <Hap metin="Konumu değiştir" onPress={onKonum} />
            <Hap metin="Favorilerim" varyant="brandSoft" onPress={() => navigation.navigate('Favoriler')} />
          </View>
        </View>
      ) : (
        <FlatList
          data={liste}
          keyExtractor={r => String(r.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ marginBottom: 14, marginHorizontal: -16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setKategori(null)}
                  style={{
                    minHeight: 40, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 999,
                    backgroundColor: kategori ? R.kart : R.marka,
                    borderWidth: 1, borderColor: kategori ? R.cizgi : R.marka,
                  }}>
                  <Text style={{
                    fontFamily: F.govdeKalin, fontSize: 13,
                    color: kategori ? R.murekkep2 : R.uzeriMarka,
                  }}>Tümü</Text>
                </Pressable>
                {CATEGORIES.map(k => {
                  const secili = kategori === k.name;
                  return (
                    <Pressable
                      key={k.name}
                      accessibilityRole="button"
                      accessibilityState={{ selected: secili }}
                      onPress={() => setKategori(secili ? null : k.name)}
                      style={{
                        minHeight: 40, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 999,
                        backgroundColor: secili ? R.marka : R.kart,
                        borderWidth: 1, borderColor: secili ? R.marka : R.cizgi,
                      }}>
                      <Text style={{
                        fontFamily: secili ? F.govdeKalin : F.govdeOrta, fontSize: 13,
                        color: secili ? R.uzeriMarka : R.murekkep2,
                      }}>{k.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) => (
            <Satir
              r={item}
              favori={depo.favoriler.includes(String(item.id))}
              onFavori={favoriCevir}
              onPress={r => navigation.navigate('detay', { id: r.id })}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={{ fontFamily: F.baslik, fontSize: 18, color: R.murekkep }}>Sonuç yok</Text>
              <Text style={{ fontFamily: F.govde, fontSize: 14, color: R.solgun, marginTop: 6, textAlign: 'center' }}>
                "{arama}" için mekan bulunamadı.
              </Text>
              <Hap metin="Kaydırarak keşfet" varyant="brandSoft" tamGenislik={false}
                stil={{ marginTop: 16 }} onPress={() => navigation.navigate('Kaydır')} />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

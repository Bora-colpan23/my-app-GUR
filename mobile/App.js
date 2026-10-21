// ═══════════════════════════════════════════════════════════════════════
// GUR — App Store / Google Play uygulaması
//
// Bu bir web sitesi kabuğu DEĞİL: React Native ekranları, gerçek
// dokunma hareketleri (Gesture Handler + Reanimated), yerli konum izni
// ve mağazaya yüklenebilir bir paket. Veri katmanı webdekiyle AYNI
// sunucuya bakıyor (src/api.js → /api), saf kurgu modülleri de ortak
// (shared/deck.js, shared/deeplink.js).
//
// Açılış sırası:
//   yerli açılış ekranı (expo-splash-screen, GUR markası)
//     → fontlar + yerel depo hidrasyonu
//     → marka anı (Acilis, ~2.6 sn / dönen kullanıcıda ~0.7 sn)
//     → rıza kutusu (karar verilmeden geçilmez)
//     → kimlik yoksa karşılama, varsa sekmeler
// ═══════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_800ExtraBold, Poppins_900Black,
} from '@expo-google-fonts/poppins';
import {
  Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
} from '@expo-google-fonts/outfit';

import { R, F, G } from './src/tema.js';
import { Ikon } from './src/bilesen/Ikon.js';
import { hidrateEt, useDepo, yaz } from './src/depo.js';
import { jetonuYukle, modaKarar } from './src/api.js';
import { havuzuGetir, yakinaGore, TOHUM } from './src/veri.js';

import Acilis from './src/ekran/Acilis.js';
import Riza from './src/ekran/Riza.js';
import Karsilama from './src/ekran/Karsilama.js';
import Giris from './src/ekran/Giris.js';
import KonumEkrani from './src/ekran/Konum.js';
import Kesfet from './src/ekran/Kesfet.js';
import Kaydir from './src/ekran/Kaydir.js';
import Favoriler from './src/ekran/Favoriler.js';
import Profil from './src/ekran/Profil.js';
import Detay from './src/ekran/Detay.js';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Yigin = createNativeStackNavigator();
const Sekme = createBottomTabNavigator();

const TEMA = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: R.bg, card: R.kart, text: R.murekkep, primary: R.marka, border: R.cizgi },
};

const SEKMELER = [
  { ad: 'Keşfet', ikon: 'search' },
  { ad: 'Kaydır', ikon: 'kart' },
  { ad: 'Favoriler', ikon: 'heart' },
  { ad: 'Profil', ikon: 'kisi' },
];

function Sekmeler({ feed, onKonum }) {
  return (
    <Sekme.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: R.marka,
        tabBarInactiveTintColor: R.solgun,
        tabBarLabelStyle: { fontFamily: F.govdeYari, fontSize: 11.5 },
        tabBarStyle: {
          backgroundColor: R.kart,
          borderTopColor: R.cizgi,
          height: 62,
          paddingTop: 6,
        },
        tabBarIcon: ({ color, focused }) => (
          <Ikon
            n={SEKMELER.find(s => s.ad === route.name)?.ikon || 'plate'}
            size={22}
            color={color}
            strokeWidth={focused ? 2.5 : 2}
          />
        ),
      })}>
      <Sekme.Screen name="Keşfet">
        {props => <Kesfet {...props} restoranlar={feed} onKonum={onKonum} />}
      </Sekme.Screen>
      <Sekme.Screen name="Kaydır">
        {props => <Kaydir {...props} restoranlar={feed} />}
      </Sekme.Screen>
      <Sekme.Screen name="Favoriler">
        {props => <Favoriler {...props} restoranlar={feed} />}
      </Sekme.Screen>
      <Sekme.Screen name="Profil" component={Profil} />
    </Sekme.Navigator>
  );
}

export default function App() {
  const [fontHazir] = useFonts({
    Poppins_600SemiBold, Poppins_800ExtraBold, Poppins_900Black,
    Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
  });
  const [depoHazir, setDepoHazir] = useState(false);
  const [acilisBitti, setAcilisBitti] = useState(false);
  const [restoranlar, setRestoranlar] = useState(TOHUM);
  const depo = useDepo();

  useEffect(() => {
    // Üçü paralel: hiçbiri diğerini beklemiyor, hiçbiri ekranı
    // kilitlemiyor. Sunucu yoksa mod yerele düşüyor ve akış sürüyor.
    jetonuYukle();
    modaKarar();
    hidrateEt().finally(() => setDepoHazir(true));
  }, []);

  useEffect(() => {
    let iptal = false;
    havuzuGetir().then(l => { if (!iptal) setRestoranlar(l); }).catch(() => {});
    return () => { iptal = true; };
  }, []);

  const hazir = fontHazir && depoHazir;
  const yerliAcilisiKapat = useCallback(() => {
    if (hazir) SplashScreen.hideAsync().catch(() => {});
  }, [hazir]);

  // Konuma göre sıralama — sunucunun kullandığı fonksiyonun aynısı.
  const feed = useMemo(
    () => yakinaGore(restoranlar, depo.konum ? { lat: depo.konum.lat, lng: depo.konum.lng } : null),
    [restoranlar, depo.konum],
  );

  if (!hazir) return <View style={{ flex: 1, backgroundColor: R.bg }} onLayout={yerliAcilisiKapat} />;

  if (!acilisBitti) {
    return (
      <View style={{ flex: 1, backgroundColor: R.bg }} onLayout={yerliAcilisiKapat}>
        <StatusBar style="dark" />
        <Acilis
          goruldu={depo.acilisGoruldu}
          onBitti={() => { setAcilisBitti(true); if (!depo.acilisGoruldu) yaz({ acilisGoruldu: true }); }}
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Azaltılmış hareket tercihi tüm yaylara uygulanır. */}
        <ReducedMotionConfig mode={ReduceMotion.System} />
        <StatusBar style="dark" />
        <NavigationContainer theme={TEMA}>
          <Yigin.Navigator
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: R.bg } }}
            initialRouteName={depo.kullanici ? 'sekmeler' : 'karsilama'}>
            <Yigin.Screen name="karsilama" component={Karsilama} />
            <Yigin.Screen name="giris" component={Giris} />
            <Yigin.Screen name="konum" component={KonumEkrani} />
            <Yigin.Screen name="sekmeler">
              {props => (
                <Sekmeler
                  {...props}
                  feed={feed}
                  onKonum={() => props.navigation.navigate('konumDegis')}
                />
              )}
            </Yigin.Screen>
            <Yigin.Screen name="konumDegis" component={KonumEkrani}
              options={{ presentation: 'modal' }} />
            <Yigin.Screen name="detay" options={{ animation: 'slide_from_right' }}>
              {props => <Detay {...props} restoranlar={feed} />}
            </Yigin.Screen>
          </Yigin.Navigator>
        </NavigationContainer>

        {/* Rıza SPLASH GEÇİLENE KADAR sorulmuyor: ilk izlenim bir onay
            kutusu olmasın. */}
        <Riza gorunur={depo.riza === null} onKarar={(k) => yaz({ riza: k })} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

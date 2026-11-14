// ═══════════════════════════════════════════════════════════════════════
// SUPABASE İSTEMCİSİ — mobil uygulamanın tek sunucu kapısı
//
// Adres ve GENEL (anon) anahtar derleme ortamından gelir:
//   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
// `npm run supabase:kur` bunları mobile/.env ve mobile/eas.json'a yazar.
// Anon anahtar istemcide durmak için tasarlandı: veriyi RLS korur
// (supabase/migrations/…_gur_guvenlik.sql). SERVICE ANAHTARI buraya ASLA
// girmez — bir mağaza paketinin içindeki her şey okunabilir.
//
// İKİ AYRI KONU, DOSYA ADI YANILTMASIN:
//   • process.env.EXPO_PUBLIC_* DOĞRUDAN yazılmak zorunda: Metro bunları
//     derleme sırasında metin olarak yerine koyar; process.env[anahtar]
//     gibi dinamik erişim yerine konmaz ve uygulama hep YEREL'de kalırdı.
//   • Adres yoksa istemci NULL: uygulama çökmez, YEREL modda çalışır
//     (bkz. api.js). Henüz Supabase bağlanmamış bir derleme de açılır.
// ═══════════════════════════════════════════════════════════════════════

import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const URL_ = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants?.expoConfig?.extra?.supabaseUrl ||
  ''
).trim().replace(/\/+$/, '');

const ANAHTAR = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants?.expoConfig?.extra?.supabaseAnonKey ||
  ''
).trim();

export const supabaseHazir = !!(URL_ && ANAHTAR);

export const supabase = supabaseHazir
  ? createClient(URL_, ANAHTAR, {
      auth: {
        storage: AsyncStorage,          // oturum yeniden açılışta kalıcı
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,      // mobilde adres çubuğu yok
      },
    })
  : null;

// Arka plandayken belirteç yenileme zamanlayıcısı boşuna çalışmasın
// (Supabase'in React Native için önerdiği kalıp).
if (supabase) {
  AppState.addEventListener('change', (durum) => {
    if (durum === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

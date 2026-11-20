// ═══════════════════════════════════════════════════════════════════════
// KAYDIRMA KARTI — ürünün kalbi
//
// Üç yön, üç karar: sağa = kaydet, sola = geç, yukarı = "bu akşam
// buradayım". Web'de fare sürüklemesiyle yapılan işin mobilde GERÇEK
// karşılığı var; kurallar Apple'ın akışkan arayüz ilkelerinden:
//
//   • 1:1 TAKİP — kart parmağa yapışır, kavrandığı noktadaki fark korunur.
//   • KESİLEBİLİRLİK — uçarken yakalanıp geri çevrilebilir; yay animasyonu
//     hedeften değil O ANKİ değerden başlar.
//   • HIZ DEVRİ — bırakma hızı yayın başlangıç hızı olur, sürükleme ile
//     animasyon arasında dikiş kalmaz.
//   • MOMENTUM İZDÜŞÜMÜ — eşik, bırakma noktasına değil parmağın GİTTİĞİ
//     yere bakar; hafif bir fiske kartı fırlatır.
//   • LASTİK BANT — dikey eksende aşağı çekiş kademeli olarak direniyor;
//     "aşağı" bir karar değil, o yüzden kart oraya kaçmıyor.
//
// Azaltılmış hareket tercihinde kart yine kayar (hareket burada BİLGİ:
// kararın hangi yöne gittiğini söylüyor) ama yaylanma sönümleniyor.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, Dimensions, AccessibilityInfo } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, interpolate, runOnJS, Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { R, F, G, YARICAP } from '../tema.js';
import { Ikon } from './Ikon.js';
import { mesafeMetni } from '../veri.js';

const { width: EN } = Dimensions.get('window');
export const KART_EN = Math.min(EN - 28, 420);
const ESIK = KART_EN * 0.32;            // izdüşüm bu çizgiyi geçerse karar verildi
const YAY = { damping: 20, stiffness: 240, mass: 0.9 };

// Apple'ın kaydırma yavaşlaması: bırakma hızından duracağı noktayı
// kestirir. Fizik kitabındaki v²/2a DEĞİL — üstel sönüm biçimi.
function izdusum(hiz, oran = 0.995) {
  'worklet';
  return (hiz / 1000) * oran / (1 - oran);
}

const titret = (tur) => {
  if (tur === 'super') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export function KaydirmaKarti({ r, ustte, onKarar, onDetay, derinlik = 0 }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const tutuluyor = useSharedValue(0);

  const bitir = (yon) => {
    titret(yon === 'yukari' ? 'super' : 'hafif');
    onKarar?.(yon, r);
  };

  const pan = Gesture.Pan()
    .enabled(!!ustte)
    // 10 px HİSTEREZİS: imleç/parmak bu kadar kaymadan hareket
    // "sürükleme" sayılmıyor, dokunuş ile kaydırma birbirine karışmıyor.
    .activeOffsetX([-10, 10])
    .activeOffsetY([-14, 14])
    .onBegin(() => { tutuluyor.value = withSpring(1, YAY); })
    .onUpdate(e => {
      x.value = e.translationX;
      // LASTİK BANT: yukarı serbest, aşağı kademeli direniyor. "Aşağı"
      // bir karar taşımıyor; kartın oraya kaçması yanlış bir vaat olurdu.
      y.value = e.translationY < 0
        ? e.translationY
        : (e.translationY * 180) / (180 + 0.55 * e.translationY);
    })
    .onEnd(e => {
      tutuluyor.value = withSpring(0, YAY);
      const hedefX = x.value + izdusum(e.velocityX);
      const hedefY = y.value + izdusum(e.velocityY);

      if (hedefY < -ESIK * 1.25 && Math.abs(hedefX) < ESIK) {
        y.value = withSpring(-900, { ...YAY, velocity: e.velocityY });
        runOnJS(bitir)('yukari');
        return;
      }
      if (Math.abs(hedefX) > ESIK) {
        const yon = hedefX > 0 ? 'sag' : 'sol';
        x.value = withSpring(hedefX > 0 ? EN * 1.5 : -EN * 1.5, { ...YAY, velocity: e.velocityX });
        y.value = withSpring(y.value + e.velocityY * 0.05, YAY);
        runOnJS(bitir)(yon);
        return;
      }
      // Karar yok: hız devriyle yerine döner — sert bir geri çekme değil.
      x.value = withSpring(0, { ...YAY, velocity: e.velocityX });
      y.value = withSpring(0, { ...YAY, velocity: e.velocityY });
    });

  const dokun = Gesture.Tap()
    .enabled(!!ustte)
    .maxDistance(10)                     // 10 px histerezis: sürükleme tık sayılmasın
    .onEnd((_, basarili) => { if (basarili) runOnJS(onDetay || (() => {}))(r); });

  // Exclusive: sürükleme etkinleşirse dokunuş iptal olur. Simultaneous
  // ikisini birden tanımaya çalışıyor ve karar anını bulanıklaştırıyordu.
  const hareket = Gesture.Exclusive(pan, dokun);

  const kart = useAnimatedStyle(() => {
    const egim = interpolate(x.value, [-EN, 0, EN], [-14, 0, 14], Extrapolation.CLAMP);
    const yigin = derinlik * 14;
    const kucul = 1 - derinlik * 0.045;
    return {
      transform: [
        { translateX: x.value },
        { translateY: y.value + yigin },
        { rotateZ: `${egim}deg` },
        { scale: kucul + tutuluyor.value * 0.012 },
      ],
      zIndex: 10 - derinlik,
    };
  });

  // Etiketler kararı ÖNCEDEN söylüyor: ara kareler nereye gidildiğini
  // telgraflamalı (hint in the direction of the gesture).
  const sagEtiket = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, ESIK], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(x.value, [0, ESIK], [0.86, 1], Extrapolation.CLAMP) }],
  }));
  const solEtiket = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-ESIK, 0], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(x.value, [-ESIK, 0], [1, 0.86], Extrapolation.CLAMP) }],
  }));
  const ustEtiket = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [-ESIK * 1.25, -20], [1, 0], Extrapolation.CLAMP),
  }));

  const foto = r?.imgs?.[0];
  const mesafe = mesafeMetni(r);

  return (
    <GestureDetector gesture={hareket}>
      <Animated.View
        accessibilityRole="button"
        accessibilityLabel={`${r?.name}. ${r?.cat}. Puan ${r?.rating}. Detay için dokun.`}
        style={[{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          borderRadius: 28, overflow: 'hidden', backgroundColor: R.gorselBg,
        }, G.koyu3, kart]}>
        <Image
          source={foto ? { uri: foto } : null}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          contentFit="cover"
          transition={220}
          accessibilityIgnoresInvertColors
        />
        {/* Fotoğraf perdesi: elle iki duraklı siyah→saydam geçişi ortada
            gri bir pus bırakıyordu; duraklar yumuşatma eğrisinde. */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.86)']}
          locations={[0, 0.45, 0.76, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' }}
        />

        {r?.gastro ? (
          <View style={{
            position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(255,102,0,0.94)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
          }}>
            <Ikon n="star" size={12} color="#fff" />
            <Text style={{ fontFamily: F.govdeKalin, fontSize: 10.5, letterSpacing: 1.1, color: '#fff' }}>
              GASTRO ONAYLI
            </Text>
          </View>
        ) : null}

        {r?.sponsored ? (
          <View style={{
            position: 'absolute', top: 16, right: 16,
            backgroundColor: 'rgba(28,20,12,0.78)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
          }}>
            <Text style={{ fontFamily: F.govdeYari, fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.92)' }}>
              SPONSORLU
            </Text>
          </View>
        ) : null}

        {/* Karar etiketleri */}
        <Animated.View style={[{
          position: 'absolute', top: 70, left: 18, borderWidth: 3, borderColor: R.olumluAcik,
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, transform: [{ rotate: '-12deg' }],
        }, sagEtiket]}>
          <Text style={{ fontFamily: F.baslik, fontSize: 24, color: R.olumluAcik, letterSpacing: 1 }}>KAYDET</Text>
        </Animated.View>
        <Animated.View style={[{
          position: 'absolute', top: 70, right: 18, borderWidth: 3, borderColor: R.olumsuzAcik,
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, transform: [{ rotate: '12deg' }],
        }, solEtiket]}>
          <Text style={{ fontFamily: F.baslik, fontSize: 24, color: R.olumsuzAcik, letterSpacing: 1 }}>GEÇ</Text>
        </Animated.View>
        <Animated.View style={[{
          position: 'absolute', top: 24, alignSelf: 'center', borderWidth: 3, borderColor: R.markaAcik,
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7,
        }, ustEtiket]}>
          <Text style={{ fontFamily: F.baslik, fontSize: 20, color: R.markaAcik, letterSpacing: 1 }}>
            BU AKŞAM
          </Text>
        </Animated.View>

        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
            }}>
              <Ikon n="star" size={11} color={R.uyariMurekkep} />
              <Text style={{ fontFamily: F.govdeKalin, fontSize: 12, color: R.murekkep }}>{r?.rating}</Text>
            </View>
            {mesafe ? (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999,
                paddingHorizontal: 9, paddingVertical: 4,
              }}>
                <Text style={{ fontFamily: F.govdeOrta, fontSize: 12, color: '#fff' }}>{mesafe}</Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={1} style={{ fontFamily: F.baslik, fontSize: 27, color: '#fff', letterSpacing: -0.6 }}>
            {r?.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: F.govdeOrta, fontSize: 14, color: 'rgba(255,255,255,0.84)', marginTop: 3 }}>
            {r?.cat}{r?.price ? ` · ${r.price}` : ''}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default KaydirmaKarti;

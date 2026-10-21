// ═══════════════════════════════════════════════════════════════════════
// AÇILIŞ — marka anı, HİÇBİR YÜKLEMEYE BAĞLI DEĞİL
//
// Kabul edilen kural: açılış ekranı 1–3 saniye görünür. Daha uzun
// kalacaksa yükleme göstergesi ister — ama buraya çark takmak yalan
// olurdu, çünkü beklenen bir şey yok (veriler yerelde, sunucu yoklaması
// arka planda). Süreler webdekiyle aynı:
//
//   ilk açılış ~2.6 sn · dönen kullanıcı ~0.7 sn · azaltılmış hareket
//   ~0.2 sn · ekrana dokunma: anında
//
// Yerli açılış ekranı (expo-splash-screen) aynı markayı aynı zeminde
// gösteriyor; geçiş görünmüyor.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from 'react-native-reanimated';
import { R, F } from '../tema.js';
import { Logo } from '../bilesen/Logo.js';

export default function Acilis({ goruldu, onBitti }) {
  const az = useReducedMotion();
  const { width } = useWindowDimensions();

  // Katsayı TEK YERDE: süreleri tek tek kısaltmak fazların birbirine
  // girmesi demekti.
  const k = az ? 0.08 : goruldu ? 0.27 : 1;
  const toplam = Math.round(2600 * k);

  const markaOp = useSharedValue(0);
  const markaOlcek = useSharedValue(0.86);
  const altOp = useSharedValue(0);
  const cizgi = useSharedValue(0);

  useEffect(() => {
    markaOp.value = withTiming(1, { duration: 420 * k, easing: Easing.out(Easing.cubic) });
    markaOlcek.value = withSpring(1, { damping: 18, stiffness: 150, mass: 0.8 });
    altOp.value = withDelay(430 * k, withTiming(1, { duration: 480 * k }));
    cizgi.value = withDelay(260 * k, withTiming(1, { duration: 900 * k, easing: Easing.out(Easing.cubic) }));
    const t = setTimeout(() => onBitti?.(), toplam);
    return () => clearTimeout(t);
  }, [k, toplam, onBitti, markaOp, markaOlcek, altOp, cizgi]);

  const sMarka = useAnimatedStyle(() => ({
    opacity: markaOp.value,
    transform: [{ scale: markaOlcek.value }],
  }));
  const sAlt = useAnimatedStyle(() => ({ opacity: altOp.value }));
  const sCizgi = useAnimatedStyle(() => ({
    width: 0, // genişlik animasyonu yeniden yerleşim yaptırır — ölçekle
    transform: [{ scaleX: cizgi.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Açılışı geç"
      onPress={() => onBitti?.()}
      style={{ flex: 1, backgroundColor: R.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={sMarka}>
        <Logo size={74} />
      </Animated.View>

      <Animated.View style={[{
        height: 3, width: Math.min(width * 0.34, 150), marginTop: 18,
        backgroundColor: R.marka, borderRadius: 2,
      }, sCizgi]} />

      <Animated.Text style={[{
        fontFamily: F.govdeKalin, fontSize: 12, letterSpacing: 4.5,
        color: R.solgun, marginTop: 18,
      }, sAlt]}>
        LEZZET PLATFORMU
      </Animated.Text>

      <Animated.Text style={[{
        position: 'absolute', bottom: 46, fontFamily: F.govde, fontSize: 12.5, color: R.solgun,
      }, sAlt]}>
        İstanbul
      </Animated.Text>
    </Pressable>
  );
}

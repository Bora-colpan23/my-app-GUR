// ═══════════════════════════════════════════════════════════════════════
// "One" buton dili — mobil karşılığı
//
// Bütün haplar tek tarifte: tam yuvarlak, kalın yazı, rengine göre
// tonlanmış dar bir düşüş gölgesi, basılınca küçülme. Varyant adları
// webdekiyle AYNI; iki kabukta farklı isimler kullanmak er geç iki ayrı
// tasarım dili demekti.
//
// DEVRE DIŞI HAP SOLUKLAŞTIRILMIYOR (opacity yasak — bkz. CLAUDE.md):
// kendi rengini koruyup geri çekiliyor, fark RENKLE.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react';
import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { R, F, G, GRADYAN, HEDEF } from '../tema.js';

const PALET = {
  filled:      { bg: null, grad: GRADYAN, ink: R.uzeriMarka, golge: G.marka, cep: { bg: '#fff', ink: '#C24B00' } },
  ink:         { bg: R.espresso, ink: '#fff', golge: G.g2, cep: { bg: '#fff', ink: R.espresso } },
  onColor:     { bg: '#fff', ink: R.markaMurekkep, golge: G.g2, cep: { bg: R.marka, ink: '#fff' } },
  outlineDark: { bg: R.kart, ink: R.murekkep, kenar: R.cizgi, golge: G.g2, cep: { bg: R.espresso, ink: '#fff' } },
  outlineBrand:{ bg: 'rgba(255,255,255,0.12)', ink: R.uzeriMarka, kenar: 'rgba(255,255,255,0.5)', cep: { bg: '#fff', ink: '#C24B00' } },
  brandSoft:   { bg: '#FDECDE', ink: R.markaMurekkepYumusak, cep: { bg: R.marka, ink: '#fff' } },
  plainDark:   { bg: 'transparent', ink: R.markaMurekkep, cep: { bg: R.marka, ink: '#fff' } },
  plainOnDark: { bg: 'transparent', ink: R.markaAcik, cep: { bg: R.marka, ink: '#fff' } },
  // Devre dışı: kendi ailesinden nötr bir ton, soluklaştırma yok.
  kapali:      { bg: R.sicak1, ink: R.solgun, kenar: R.cizgi },
};

const DOLGU = { lg: { v: 16, h: 30, f: 16 }, md: { v: 13, h: 22, f: 14 }, sm: { v: 9, h: 16, f: 12.5 } };

export function Hap({
  metin, onPress, varyant = 'filled', boy = 'lg', tamGenislik = true,
  kapali = false, yukleniyor = false, cep = null, stil,
}) {
  const kapaliMi = kapali || yukleniyor;
  const p = kapaliMi && kapali ? PALET.kapali : (PALET[varyant] || PALET.filled);
  const d = DOLGU[boy] || DOLGU.lg;
  const olcek = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: olcek.value }] }));

  const govde = (
    <>
      {yukleniyor ? <ActivityIndicator size="small" color={p.ink} /> : null}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{ fontFamily: F.govdeKalin, fontSize: d.f, color: p.ink, letterSpacing: -0.1 }}>
        {yukleniyor ? 'Yükleniyor…' : metin}
      </Text>
      {!yukleniyor && cep ? (
        <View style={{
          width: d.f + 10, height: d.f + 10, borderRadius: 999,
          backgroundColor: p.cep?.bg || '#fff',
          alignItems: 'center', justifyContent: 'center',
        }}>{typeof cep === 'function' ? cep(p.cep?.ink) : cep}</View>
      ) : null}
    </>
  );

  const ic = {
    minHeight: HEDEF,
    paddingVertical: d.v, paddingHorizontal: d.h, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    borderWidth: p.kenar ? 1 : 0, borderColor: p.kenar || 'transparent',
  };

  return (
    <Animated.View style={[{ alignSelf: tamGenislik ? 'stretch' : 'flex-start' }, anim, stil]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: kapaliMi, busy: yukleniyor }}
        disabled={kapaliMi}
        // Geri bildirim BASARKEN, bırakırken değil: gecikme hissi
        // doğrudanlığı öldürüyor (bkz. apple-design → Response).
        onPressIn={() => { olcek.value = withSpring(0.965, { damping: 18, stiffness: 320 }); }}
        onPressOut={() => { olcek.value = withSpring(1, { damping: 18, stiffness: 320 }); }}
        onPress={() => { if (!kapaliMi) { Haptics.selectionAsync().catch(() => {}); onPress?.(); } }}
        style={[ic, p.grad ? null : { backgroundColor: p.bg }, !kapaliMi && p.golge ? p.golge : null]}>
        {p.grad ? (
          <LinearGradient
            colors={p.grad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999 }}
          />
        ) : null}
        {govde}
      </Pressable>
    </Animated.View>
  );
}

export default Hap;

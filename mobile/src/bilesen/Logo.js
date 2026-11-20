// GUR kelime markası. Üç harf üç renk — logotype olduğu için paletin
// "tek rol tek renk" kuralının dışında (bkz. CLAUDE.md).
import React from 'react';
import { Text, View } from 'react-native';
import { R, F, G } from '../tema.js';

export function Logo({ size = 42, hap = false }) {
  const yazi = { fontSize: size, fontFamily: F.baslikKara, letterSpacing: -size / 24, lineHeight: size * 1.18 };
  const marka = (
    <Text style={yazi} allowFontScaling={false} accessibilityLabel="GUR">
      <Text style={{ color: R.logoG }}>G</Text>
      <Text style={{ color: R.logoU }}>U</Text>
      <Text style={{ color: R.logoR }}>R</Text>
    </Text>
  );
  if (!hap) return marka;
  return (
    <View style={[{
      backgroundColor: R.kart, borderRadius: size * 0.5,
      paddingVertical: size * 0.1, paddingHorizontal: size * 0.32,
      alignSelf: 'flex-start',
    }, G.g1]}>{marka}</View>
  );
}

export default Logo;

// Sol üstteki konum çipi BİR DÜĞMEDİR: dokununca izni tekrar isteyebilir
// ya da ilçeyi değiştirebilirsin. Reddeden kullanıcı sistem ayarlarına
// gitmeden geri dönebilsin diye bu yol her ekranda duruyor.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { R, F, HEDEF } from '../tema.js';
import { Ikon } from './Ikon.js';
import { konumEtiketi } from '../konum.js';

export function KonumCipi({ konum, onPress }) {
  const e = konumEtiketi(konum);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Konum: ${e.ust}. Değiştirmek için dokun.`}
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        minHeight: HEDEF, paddingRight: 8,
      }}>
      <View style={{
        width: 32, height: 32, borderRadius: 999, backgroundColor: R.markaYumusak,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ikon n="pin" size={15} color={R.marka} />
      </View>
      <View>
        <Text style={{ fontFamily: F.govde, fontSize: 11, color: R.solgun }}>{e.ust}</Text>
        <Text style={{ fontFamily: F.govdeKalin, fontSize: 13.5, color: R.murekkep }}>{e.alt}</Text>
      </View>
    </Pressable>
  );
}
export default KonumCipi;

// Metin alanı. Etiket süs değil: `accessibilityLabel` ile bağlı ve
// taban ölçü 16 — iOS'ta 16'dan küçük alan odaklanınca sayfayı
// yakınlaştırıyor, mobilde de okunurluk tabanı bu.
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { R, F } from '../tema.js';

export function Alan({
  etiket, deger, onChangeText, placeholder, gizli = false,
  klavye = 'default', otomatik = 'none', hata, stil,
}) {
  const [odak, setOdak] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, stil]}>
      {etiket ? (
        <Text style={{
          fontFamily: F.govdeYari, fontSize: 12.5, color: R.murekkep2,
          marginBottom: 7, letterSpacing: 0.2,
        }}>{etiket}</Text>
      ) : null}
      <TextInput
        accessibilityLabel={etiket}
        value={deger}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={R.solgun}
        secureTextEntry={gizli}
        keyboardType={klavye}
        autoCapitalize={otomatik}
        autoCorrect={false}
        onFocus={() => setOdak(true)}
        onBlur={() => setOdak(false)}
        style={{
          backgroundColor: R.kart,
          borderWidth: 1,
          borderColor: hata ? R.olumsuz : odak ? R.marka : R.cizgi,
          borderRadius: 14,
          paddingHorizontal: 15,
          paddingVertical: 14,
          minHeight: 48,
          fontFamily: F.govde,
          fontSize: 16,                 // 16'nın altına İNMEYİN
          color: R.murekkep,
        }}
      />
      {hata ? (
        <Text accessibilityRole="alert" style={{
          fontFamily: F.govdeOrta, fontSize: 12.5, color: R.olumsuzMurekkep, marginTop: 6,
        }}>{hata}</Text>
      ) : null}
    </View>
  );
}

export default Alan;

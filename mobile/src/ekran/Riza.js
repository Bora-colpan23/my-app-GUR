// ═══════════════════════════════════════════════════════════════════════
// RIZA — bir MODAL, karar verilmeden geçilemez
//
// KARANLIK KALIP YOK: iki seçenek AYNI görsel ağırlıkta; reddetmek kabul
// etmek kadar kolay. Perdeye dokunmak kapatmıyor — rıza sorusunun
// sessizce geçiştirilecek bir cevabı yok.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, Modal } from 'react-native';
import { R, F, G } from '../tema.js';
import { Hap } from '../bilesen/Hap.js';
import { Ikon } from '../bilesen/Ikon.js';

export default function Riza({ gorunur, onKarar }) {
  return (
    <Modal visible={gorunur} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(16,12,8,0.5)', justifyContent: 'flex-end' }}>
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[{
            backgroundColor: R.kart, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 24, paddingBottom: 34,
          }, G.g4]}>
          <View style={{
            width: 44, height: 44, borderRadius: 999, backgroundColor: R.markaYumusak,
            alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <Ikon n="shield" size={20} color={R.marka} />
          </View>
          <Text style={{ fontFamily: F.baslik, fontSize: 20, color: R.murekkep, letterSpacing: -0.5 }}>
            Ölçümleme çerezleri
          </Text>
          <Text style={{ fontFamily: F.govde, fontSize: 14.5, lineHeight: 22, color: R.solgun, marginTop: 8 }}>
            Uygulamayı geliştirmek için anonim kullanım istatistikleri
            toplayabiliriz. Zorunlu olanlar dışında hiçbir şey iznin
            olmadan çalışmaz; kararını profilden her zaman değiştirebilirsin.
          </Text>
          {/* İki yol da AYNI boy: biri hap, biri kenarlıklı hap. */}
          <View style={{ gap: 10, marginTop: 20 }}>
            <Hap metin="Kabul et" onPress={() => onKarar('kabul')} />
            <Hap metin="Yalnızca zorunlu" varyant="outlineDark" onPress={() => onKarar('ret')} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

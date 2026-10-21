// ═══════════════════════════════════════════════════════════════════════
// GİRİŞ / KAYIT
//
// DOĞRULAMA HER İKİ MODDA DA ÇALIŞIR. Web tarafında bir dönem mod
// kontrolü doğrulamadan ÖNCE geliyordu ve yerel modda BOŞ e-posta + BOŞ
// parolayla giriş yapılabiliyordu. "Yerel modda giriş bir formalite"
// doğru olabilir ama formu doğrulamamak, alanları hiç sormamaktan kötü:
// kullanıcı yazdığının bir yere gittiğini sanıyor.
//
// KOŞUL ONAYI DEKORATİF DEĞİL: kutu işaretlenmeden kayıt tamamlanmıyor
// ve düğmenin neden kapalı olduğu yazıyor.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { R, F, HEDEF } from '../tema.js';
import { Logo } from '../bilesen/Logo.js';
import { Ikon } from '../bilesen/Ikon.js';
import { Hap } from '../bilesen/Hap.js';
import { Alan } from '../bilesen/Alan.js';
import { yaz } from '../depo.js';
import { girisYap, canliMi } from '../api.js';

const epostaGecerli = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export default function Giris({ navigation, route }) {
  const [kayit, setKayit] = useState(!!route?.params?.kayit);
  const [ad, setAd] = useState('');
  const [eposta, setEposta] = useState('');
  const [parola, setParola] = useState('');
  const [onay, setOnay] = useState(false);
  const [hata, setHata] = useState(null);
  const [bekle, setBekle] = useState(false);

  const eksik = kayit
    ? (!ad.trim() ? 'Adını yaz' : !epostaGecerli(eposta) ? 'Geçerli bir e-posta yaz'
      : parola.length < 6 ? 'Parola en az 6 karakter olmalı' : !onay ? 'Koşulları onayla' : null)
    : (!epostaGecerli(eposta) ? 'Geçerli bir e-posta yaz'
      : parola.length < 6 ? 'Parola en az 6 karakter olmalı' : null);

  const gonder = async () => {
    // DOĞRULAMA İLK SATIRDA, mod kontrolü sonra.
    if (eksik) { setHata(eksik); return; }
    setHata(null); setBekle(true);
    try {
      let kullanici = { ad: ad.trim() || eposta.split('@')[0], email: eposta.trim() };
      if (canliMi()) {
        const c = await girisYap({ email: eposta.trim(), password: parola, name: ad.trim() || undefined });
        if (c?.user) kullanici = { ad: c.user.name || kullanici.ad, email: c.user.email || kullanici.email };
      }
      yaz({ kullanici });
      navigation.reset({ index: 0, routes: [{ name: 'konum', params: { kayittan: kayit } }] });
    } finally {
      setBekle(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: R.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button" accessibilityLabel="Geri"
            style={{ width: HEDEF, height: HEDEF, justifyContent: 'center' }}>
            <Ikon n="geri" size={22} color={R.murekkep} />
          </Pressable>

          <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 26 }}>
            <Logo size={56} />
          </View>

          <Text style={{ fontFamily: F.baslik, fontSize: 26, letterSpacing: -0.8, color: R.murekkep }}>
            {kayit ? 'Hesap oluştur' : 'Tekrar hoş geldin'}
          </Text>
          <Text style={{ fontFamily: F.govde, fontSize: 14.5, color: R.solgun, marginTop: 6, marginBottom: 22, lineHeight: 22 }}>
            {kayit
              ? 'Favorilerin ve yorumların hesabına bağlı kalsın.'
              : 'Kaldığın yerden devam et.'}
          </Text>

          {kayit ? (
            <Alan etiket="Ad Soyad" deger={ad} onChangeText={setAd} placeholder="Adın" otomatik="words" />
          ) : null}
          <Alan etiket="E-posta" deger={eposta} onChangeText={setEposta}
            placeholder="ornek@mail.com" klavye="email-address" />
          <Alan etiket="Parola" deger={parola} onChangeText={setParola}
            placeholder="En az 6 karakter" gizli />

          {kayit ? (
            <Pressable
              onPress={() => setOnay(v => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: onay }}
              accessibilityLabel="Kullanım koşullarını ve gizlilik metnini kabul ediyorum"
              style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start', minHeight: HEDEF, paddingVertical: 8 }}>
              <View style={{
                width: 26, height: 26, borderRadius: 8, borderWidth: 2,
                borderColor: onay ? R.marka : R.cizgi,
                backgroundColor: onay ? R.marka : 'transparent',
                alignItems: 'center', justifyContent: 'center', marginTop: 1,
              }}>
                {onay ? <Ikon n="check" size={15} color="#fff" strokeWidth={3} /> : null}
              </View>
              <Text style={{ flex: 1, fontFamily: F.govde, fontSize: 13.5, color: R.murekkep2, lineHeight: 20 }}>
                Kullanım koşullarını ve gizlilik metnini okudum, kabul ediyorum.
              </Text>
            </Pressable>
          ) : null}

          {hata ? (
            <Text accessibilityRole="alert" style={{
              fontFamily: F.govdeOrta, fontSize: 13, color: R.olumsuzMurekkep, marginBottom: 12,
            }}>{hata}</Text>
          ) : null}

          <Hap
            metin={kayit ? 'Kaydını tamamla' : 'Giriş yap'}
            onPress={gonder}
            yukleniyor={bekle}
            stil={{ marginTop: 6 }}
          />

          <Pressable
            onPress={() => { setKayit(v => !v); setHata(null); }}
            accessibilityRole="button"
            style={{ minHeight: HEDEF, justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
            <Text style={{ fontFamily: F.govdeYari, fontSize: 14, color: R.markaMurekkep }}>
              {kayit ? 'Hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt için dokun'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

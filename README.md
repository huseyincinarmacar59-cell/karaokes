# 🎤 Cep Karaoke

Telefonun mikrofonundan aldığı sesi, müzikle birlikte Bluetooth hoparlöre veren karaoke web uygulaması. Kurulum gerekmez, iPhone'da ve Android'de tarayıcıdan çalışır.

## Özellikler
- 🎙️ Mikrofondan Bluetooth hoparlöre canlı ses
- 🎵 Telefondan şarkı/altyapı seçip çalma
- 🎚️ Mikrofon ve müzik için ayrı ses seviyesi
- ✨ Yankı (sahne efekti) ve 🔁 eko
- 🛡️ Cızırtı önleyici
- 🎬 Sahne modu: şarkı sözleri büyük yazıyla akar
- ⏺️ Kayıt: müzik ve ses birlikte kaydedilir, indirilebilir
- 📱 Ekran açıkken kapanmaz

## Kullanım
1. Telefonu Bluetooth hoparlöre bağla.
2. Sayfayı aç ve **Mikrofonu Aç**'a bas, izin ver.
3. Şarkıyı seç, **Çal**'a bas, söyle 🎤

## Yayınlama (GitHub Pages)
Mikrofon yalnızca **https** üzerinden çalışır:
Repo → **Settings → Pages → Branch: `main` / root → Save**.
Birkaç dakika sonra `https://KULLANICI.github.io/REPO/` adresinden açılır.

## Bilinmesi gerekenler
- Bluetooth'un kendi gecikmesi var (~0,2-0,3 sn). Bu kodla tamamen yok edilemez.
- Hoparlöre çok yaklaşırsan feedback (cızırtı) olur. Biraz uzak dur ya da **Cızırtı önleyici**'yi aç.
- iPhone'da ses kalitesi düşük gelirse hoparlörün kendi mikrofonu devreye girmiş olabilir. Bluetooth'u kapatıp açmak genelde çözer.

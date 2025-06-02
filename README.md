# Bless Anime Game

Modern bir 3D anime tarzı aksiyon oyunu. Three.js ve TypeScript kullanılarak geliştirilmiştir.

## 🎮 Özellikler

- 3D anime tarzı grafikler
- Karakter seçim sistemi (12 farklı karakter)
- Silah seçim sistemi (7 farklı silah)
- Dinamik görev sistemi
- Modern UI/UX tasarımı
- Gerçek zamanlı savaş sistemi
- AI destekli düşman davranışları
- Yüksek performanslı render sistemi
- Responsive tasarım

## 🚀 Başlangıç

### Gereksinimler

- Node.js (v14.0.0 veya üzeri)
- npm (v6.0.0 veya üzeri)
- Modern bir web tarayıcısı (Chrome, Firefox, Safari)

### Kurulum

1. Repoyu klonlayın:
```bash
git clone https://github.com/yourusername/bless-anime-game.git
cd bless-anime-game
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Geliştirme sunucusunu başlatın:
```bash
npm run dev
```

4. Tarayıcınızda açın:
```
http://localhost:3000
```

### Derleme

Production sürümü için:
```bash
npm run build
```

## 🎯 Oynanış

1. Ana menüden "Oyunu Başlat" veya "Karakter Seç" butonuna tıklayın
2. 12 farklı karakterden birini seçin
3. 7 farklı silahtan birini seçin
4. Oyun başladığında:
   - WASD veya ok tuşları ile hareket edin
   - Mouse ile etrafı kontrol edin
   - Sol tık ile ateş edin
   - Shift ile koşun
   - E tuşu ile karakter yeteneğini kullanın
   - ESC ile oyunu duraklatın

## 🛠 Teknolojiler

- TypeScript
- Three.js
- TensorFlow.js (AI için)
- WebGL
- HTML5 & CSS3
- Modern JavaScript (ES6+)

## 📦 Proje Yapısı

```
bless-anime-game/
├── src/                    # Kaynak kodları
│   ├── core/              # Çekirdek oyun mantığı
│   ├── utils/             # Yardımcı fonksiyonlar
│   ├── ai/                # AI sistemleri
│   └── assets/            # Oyun varlıkları
├── public/                # Statik dosyalar
│   ├── models/           # 3D modeller
│   ├── textures/         # Dokular
│   └── sounds/           # Ses dosyaları
├── scripts/               # Build scriptleri
└── tests/                # Test dosyaları
```

## 🔧 Konfigürasyon

Oyun ayarlarını `bls.toml` dosyasından özelleştirebilirsiniz:

- Grafik kalitesi
- Ses seviyeleri
- Kontrol hassasiyeti
- AI zorluk seviyesi

## 🤝 Katkıda Bulunma

1. Fork'layın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👥 Ekip

- Geliştirici Ekibi
- Tasarım Ekibi
- Test Ekibi

## 📞 İletişim

- Website: [your-website.com](https://your-website.com)
- Email: your-email@example.com
- Twitter: [@yourusername](https://twitter.com/yourusername)

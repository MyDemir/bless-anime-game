import WebServer from '@blockless/sdk-ts/dist/lib/web';
import { initGame } from './src/core/main'; // src/core/main.ts'den oyun başlatıcısını içe aktar

const server = new WebServer();

// Statik dosyaları sun
server.statics('public', '/');

// Oyunu başlat
initGame(); // src/core/main.ts'deki oyun başlatma fonksiyonunu çağır

// Sunucuyu başlat
server.start();

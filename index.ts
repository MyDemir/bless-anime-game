import WebServer from '@blockless/sdk-ts/dist/lib/web';

console.log("Blockless WebServer başlatılıyor");

// Web sunucusunu başlat
const server = new WebServer();
server.statics('public', '/');
server.start();

// WASM için giriş noktası
export function main() {
  console.log("WASM giriş noktası çalıştı");
}

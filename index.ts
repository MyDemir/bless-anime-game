import WebServer from '@blockless/sdk-ts/dist/lib/web';
const server = new WebServer();

// MIME türünü açıkça tanımla
server.statics('public', '/', {
  mimeTypes: {
    '.wasm': 'application/wasm'
  }
});
server.start();

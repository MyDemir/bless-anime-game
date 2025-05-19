import WebServer from '@blockless/sdk-ts/dist/lib/web';

const server = new WebServer();

// Statik dosyaları public dizininden sun
server.statics('public', '/');

// Test için bir temel rota ekle
server.on('GET', '/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to Bless Anime Game!',
    path: req.path,
    method: req.method
  });
});

// Hata ayıklama için JSON girdisini logla
server.on('request', (req, res) => {
  console.log('Received request:', {
    path: req.path,
    method: req.method,
    body: req.body
  });
});

// Sunucuyu başlat
server.start();

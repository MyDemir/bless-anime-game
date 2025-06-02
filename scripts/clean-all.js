// scripts/clean-all.js
import { rmSync } from 'fs';
import { join } from 'path';

const cleanPaths = [
    // Bağımlılık klasörleri
    'node_modules',
    '.npm',
    '.cache',
    
    // Build ve derleme dosyaları

    'build',
    'build/*',
    'build/debug.wasm',
    'build/release.wasm',
    
    // Public klasöründeki geçici dosyalar
    'public/index.js',
    'public/tfjs-backend-wasm*.wasm',
    'public/draco',
    
    // WASM dosyaları
    'public/tfjs-backend-wasm.wasm',
    'public/tfjs-backend-wasm-simd.wasm',
    'public/tfjs-backend-wasm-threaded-simd.wasm',
    
    // Package manager dosyaları
    'package-lock.json',
    'bls.assets.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    
    // Diğer geçici dosyalar ve klasörler
    
    'dist',
    'tmp',
    '.temp',
    '.DS_Store',
    'coverage',
    '.nyc_output',
    '.env.local',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local',
    
    // IDE ve editor dosyaları
    '.idea',
    '.vscode',
    '*.sublime-project',
    '*.sublime-workspace',
    
    // Log dosyaları
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',
    'debug.log'
];

console.log('🧹 Derin temizlik başlatılıyor...');
console.log('⚠️  Dikkat: Bu işlem tüm geçici dosyaları silecek!');
console.log('3 saniye içinde başlıyor...');

setTimeout(() => {
    try {
        for (const path of cleanPaths) {
            const fullPath = join(process.cwd(), path);
            try {
                console.log(`Siliniyor: ${path}`);
                rmSync(fullPath, { force: true, recursive: true });
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.warn(`Uyarı: ${path} silinirken hata oluştu:`, err.message);
                }
            }
        }

        console.log('\n✨ Derin temizlik tamamlandı!');
        console.log('\n📝 Projeyi yeniden başlatmak için:');
        console.log('1. npm cache clean --force');
        console.log('2. npm install');
        console.log('3. npm run build:debug');
        console.log('4. npm run serve');
        
    } catch (error) {
        console.error('❌ Temizlik sırasında hata oluştu:', error);
        process.exit(1);
    }
}, 3000); 
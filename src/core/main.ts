import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { Game } from './Game';
import { NotificationManager } from './NotificationManager';
import { trainModels } from '../ai/trainModel';

// WASM backend için yapılandırma
setWasmPaths('/tfjs-backend-wasm/');

// Global bildirim fonksiyonu
(window as any).showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' = 'success',
    duration: number = 3000
) => {
    NotificationManager.getInstance().show(message, type, duration);
};

// TensorFlow backend başlatma optimizasyonu
async function initializeTfBackend() {
    try {
        // TensorFlow.js hazır olana kadar bekle
        await tf.ready();

        // WASM backend kontrolü ve yedek olarak WebGL
        if (tf.findBackend('wasm')) {
            await tf.setBackend('wasm');
            await tf.ready(); // WASM backend'in tamamen hazır olmasını bekle
            console.log('TensorFlow.js WASM backend başlatıldı');
        } else {
            console.warn('WASM backend bulunamadı, WebGL kullanılacak');
            await tf.setBackend('webgl');
            await tf.ready();
            console.log('TensorFlow.js WebGL backend başlatıldı (WASM yedeği)');
        }

        // Backend durumunu kontrol et
        const currentBackend = tf.getBackend();
        console.log(`Aktif backend: ${currentBackend}`);
        return true;
    } catch (error) {
        console.error('Backend başlatma hatası:', error);
        NotificationManager.getInstance().show('AI sistemi başlatılamadı!', 'error');
        return false;
    }
}

// Model varlık kontrolü ve yükleme optimizasyonu
async function checkModelsExist(): Promise<boolean> {
    try {
        const modelKeys = ['enemy-selection-model', 'structure-placement-model'];
        const modelPromises = modelKeys.map(async (key) => {
            try {
                const model = await tf.loadLayersModel(`localstorage://${key}`);
                // Model yüklendikten sonra doğrulama
                if (model && model.layers && model.layers.length > 0) {
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        });

        const results = await Promise.all(modelPromises);
        return results.every(result => result);
    } catch (error) {
        console.warn('Model kontrolü sırasında hata:', error);
        return false;
    }
}

// Model eğitimi için yardımcı fonksiyon
async function trainAndSaveModels(): Promise<void> {
    try {
        NotificationManager.getInstance().show('AI modelleri eğitiliyor...', 'warning');
        await trainModels();
        NotificationManager.getInstance().show('AI modelleri hazır!', 'success');
    } catch (error) {
        console.error('Model eğitimi hatası:', error);
        NotificationManager.getInstance().show('Model eğitimi başarısız!', 'error');
        throw error;
    }
}

// Oyun başlatma ve hata yönetimi
async function initializeGame(canvas: HTMLCanvasElement): Promise<void> {
    try {
        // Backend başlatma kontrolü
        const backendInitialized = await initializeTfBackend();
        if (!backendInitialized) {
            throw new Error('AI sistemi başlatılamadı');
        }

        // Model kontrolü ve gerekirse eğitim
        const modelsExist = await checkModelsExist();
        if (!modelsExist) {
            await trainAndSaveModels();
        }

        // Oyun başlatma
        const game = new Game(canvas);
        NotificationManager.getInstance().show(
            `Hoş geldin ${(window as any).currentUser || 'Oyuncu'}!`, 
            'success'
        );
    } catch (error) {
        console.error('Oyun başlatma hatası:', error);
        NotificationManager.getInstance().show('Oyun başlatılamadı!', 'error');
        throw error;
    }
}

// DOM yükleme ve oyun başlatma
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Sayfa yüklendi");
    
    // Canvas elementi kontrolü
    const canvas = document.querySelector('#webgl-canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('Canvas elementi bulunamadı!');
        NotificationManager.getInstance().show('Oyun başlatılamadı: Canvas bulunamadı!', 'error');
        return;
    }

    try {
        // Oyun başlatma
        await initializeGame(canvas);
    } catch (error) {
        // Hata durumunda kullanıcıya bilgi ver
        console.error('Kritik hata:', error);
        NotificationManager.getInstance().show(
            'Oyun başlatılamadı! Lütfen sayfayı yenileyin.', 
            'error', 
            5000
        );
    }
});

// Oyun çıkış işleyicisi
window.addEventListener('beforeunload', () => {
    // Temizlik işlemleri
    tf.disposeVariables();
    tf.engine().endScope();
    tf.engine().startScope();
});

// Debug modu için yardımcı fonksiyonlar
if (process.env.NODE_ENV === 'development') {
    (window as any).tf = tf;
    (window as any).debugBackend = () => {
        console.log('Current backend:', tf.getBackend());
        console.log('Available backends:', tf.engine().registeredBackends());
        console.log('Memory stats:', tf.memory());
    };
}

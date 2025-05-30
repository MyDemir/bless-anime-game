import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { Game } from './Game';
import { NotificationManager } from './NotificationManager';
import { trainModels } from '../ai/trainModel';

// WASM backend için yolu ayarla
setWasmPaths('/public/');

// Global bildirim fonksiyonu
(window as any).showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' = 'success',
    duration: number = 3000
) => {
    NotificationManager.getInstance().show(message, type, duration);
};

// TensorFlow backend başlatma - Sadece WASM
async function initializeTfBackend() {
    try {
        await tf.setBackend('wasm');
        await tf.ready();
        console.log('TensorFlow.js WASM backend başlatıldı');
        return true;
    } catch (error) {
        console.error('WASM backend başlatılamadı:', error);
        NotificationManager.getInstance().show('AI sistemi başlatılamadı!', 'error');
        return false;
    }
}

// Model kontrolü
async function checkModels(): Promise<boolean> {
    try {
        await tf.loadLayersModel('localstorage://enemy-selection-model');
        await tf.loadLayersModel('localstorage://structure-placement-model');
        return true;
    } catch (error) {
        console.warn('Modeller bulunamadı, eğitim başlatılacak:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Sayfa yüklendi");
    const canvas = document.querySelector('#webgl-canvas') as HTMLCanvasElement;

    if (!canvas) {
        console.error('Canvas elementi bulunamadı!');
        NotificationManager.getInstance().show('Oyun başlatılamadı!', 'error');
        return;
    }

    try {
        // Sadece WASM backend başlatma kontrolü
        const backendInitialized = await initializeTfBackend();
        if (!backendInitialized) {
            throw new Error('AI sistemi başlatılamadı');
        }
        
        // Model kontrolü ve eğitimi
        const modelsExist = await checkModels();
        if (!modelsExist) {
            NotificationManager.getInstance().show('AI modelleri eğitiliyor...', 'warning');
            try {
                await trainModels();
                NotificationManager.getInstance().show('AI modelleri hazır!', 'success');
            } catch (trainError) {
                console.error('Model eğitimi hatası:', trainError);
                NotificationManager.getInstance().show('Model eğitimi başarısız!', 'error');
                throw trainError;
            }
        }

        // Oyunu başlat
        const game = new Game(canvas);
        NotificationManager.getInstance().show('Hoş geldin!', 'success');
    } catch (error) {
        console.error('Oyun başlatma hatası:', error);
        NotificationManager.getInstance().show('Oyun başlatılamadı!', 'error');
    }
});

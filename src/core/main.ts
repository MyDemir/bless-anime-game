// src/core/main.ts
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import * as THREE from 'three';
import { Game } from './Game';
import { NotificationManager } from './NotificationManager';
import { ErrorManager } from './ErrorManager';
import { trainModels } from '../ai/trainModel';
import { ModelsLoader } from '../utils/loadModels';

// WASM yapılandırması
setWasmPaths('/');

// Global bildirim fonksiyonu
(window as any).showNotification = (
  message: string,
  type: 'success' | 'error' | 'warning' = 'success',
  duration: number = 3000
) => {
  NotificationManager.getInstance().show(message, type, duration);
};

// WASM backend'i başlat
async function initTensorFlow() {
  try {
    // WASM backend'i yükle
    await tf.setBackend('wasm');
    await tf.ready();
    
    // Backend durumunu kontrol et
    const backend = tf.getBackend();
    if (backend !== 'wasm') {
      console.warn('WASM backend aktif değil, alternatif backend kullanılıyor:', backend);
      NotificationManager.getInstance().show('AI sistemi yedek modda çalışıyor', 'warning');
    } else {
      console.log('TensorFlow.js WASM backend başarıyla başlatıldı');
    }
    
    return true;
  } catch (error) {
    console.error('WASM backend başlatma hatası:', error);
    NotificationManager.getInstance().show('AI sistemi yedek moda geçti', 'warning');
    
    // CPU backend'e geç
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      return true;
    } catch (fallbackError) {
      console.error('Yedek backend başlatılamadı:', fallbackError);
      return false;
    }
  }
}

// Model kontrolü
async function checkModels(): Promise<boolean> {
  try {
    await tf.loadLayersModel('localstorage://enemy-selection-model');
    await tf.loadLayersModel('localstorage://structure-placement-model');
    console.log('AI modelleri yüklendi');
    return true;
  } catch (error) {
    console.warn('Modeller bulunamadı, eğitim başlatılacak:', error);
    ErrorManager.getInstance().handleError(error as Error, 'checkModels');
    return false;
  }
}

// Model eğitimi
async function trainModelsSafely(): Promise<boolean> {
  try {
    const canvas = document.querySelector('#webgl-canvas') as HTMLCanvasElement;
    const scene = new THREE.Scene();
    const modelsLoader = new ModelsLoader(scene);
    await trainModels(modelsLoader);
    NotificationManager.getInstance().show('AI modelleri hazır!', 'success');
    return true;
  } catch (error) {
    ErrorManager.getInstance().handleError(error as Error, 'trainModelsSafely');
    return false;
  }
}

// Canvas elementini bekle
function waitForCanvas(): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const maxAttempts = 10;
    let attempts = 0;

    function checkCanvas() {
      const canvas = document.querySelector('#webgl-canvas') as HTMLCanvasElement;
      if (canvas) {
        resolve(canvas);
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error('Canvas elementi bulunamadı!'));
        } else {
          setTimeout(checkCanvas, 100);
        }
      }
    }

    checkCanvas();
  });
}

// Ana uygulama başlatma
async function main() {
  try {
    // Canvas elementini bekle
    const canvas = await waitForCanvas();
    
    // WASM backend'i başlat
    const tfInitialized = await initTensorFlow();
    if (!tfInitialized) {
      throw new Error('TensorFlow başlatılamadı');
    }

    // Model kontrolü ve eğitimi
    const modelsExist = await checkModels();
    if (!modelsExist) {
      NotificationManager.getInstance().show('AI modelleri eğitiliyor...', 'warning');
      const modelsTrained = await trainModelsSafely();
      if (!modelsTrained) {
        throw new Error('Model eğitimi başarısız');
      }
    }

    // Oyunu başlat
    const game = new Game(canvas);
    NotificationManager.getInstance().show('Hoş geldin!', 'success');
  } catch (error) {
    console.error('Uygulama başlatma hatası:', error);
    NotificationManager.getInstance().show('Oyun başlatılamadı!', 'error');
    ErrorManager.getInstance().handleError(error as Error, 'main');
  }
}

// Sayfa yüklendiğinde uygulamayı başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

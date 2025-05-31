// src/core/main.ts
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { Game } from './Game';
import { NotificationManager } from './NotificationManager';
import { ErrorManager } from './ErrorManager';
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

// TensorFlow backend başlatma
async function initializeTfBackend(): Promise<boolean> {
  try {
    await tf.setBackend('wasm');
    await tf.ready();
    console.log('TensorFlow.js WASM backend başlatıldı');
    return true;
  } catch (error) {
    ErrorManager.getInstance().handleError(error as Error, 'initializeTfBackend');
    return false;
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
    await trainModels();
    NotificationManager.getInstance().show('AI modelleri hazır!', 'success');
    return true;
  } catch (error) {
    ErrorManager.getInstance().handleError(error as Error, 'trainModelsSafely');
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Sayfa yüklendi');
  const canvas = document.querySelector('#webgl-canvas') as HTMLCanvasElement;

  if (!canvas) {
    const error = new Error('Canvas elementi bulunamadı!');
    ErrorManager.getInstance().handleError(error, 'DOMContentLoaded.canvas');
    return;
  }

  try {
    // WASM backend başlatma
    const backendInitialized = await initializeTfBackend();
    if (!backendInitialized) {
      throw new Error('AI sistemi başlatılamadı');
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
    ErrorManager.getInstance().handleError(error as Error, 'DOMContentLoaded');
  }
});

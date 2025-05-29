import * as tf from '@tensorflow/tfjs';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { NotificationManager } from './src/core/NotificationManager';

async function initializeTfBackend(): Promise<void> {
  try {
    setWasmPaths('/tfjs-backend-wasm.wasm');
    await tf.setBackend('wasm');
    console.log('TensorFlow.js WASM backend başlatıldı');
  } catch (error) {
    console.error('WASM backend başlatılamadı:', error);
    NotificationManager.getInstance().show('AI backend başlatılamadı, CPU kullanılıyor!', 'warning');
    await tf.setBackend('cpu');
    console.log('CPU backend aktif');
  }
}

export { initializeTfBackend };

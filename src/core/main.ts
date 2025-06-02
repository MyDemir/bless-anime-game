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

// WASM configuration
setWasmPaths('/');

// Global notification function
(window as any).showNotification = (
  message: string,
  type: 'success' | 'error' | 'warning' = 'success',
  duration: number = 3000
) => {
  NotificationManager.getInstance().show(message, type, duration);
};

// Initialize WASM backend
async function initTensorFlow() {
  try {
    // Load WASM backend
    await tf.setBackend('wasm');
    await tf.ready();
    
    // Backend status check
    const backend = tf.getBackend();
    if (backend !== 'wasm') {
      console.warn('WASM backend inactive, using fallback backend:', backend);
      NotificationManager.getInstance().show('AI system running in fallback mode', 'warning');
    } else {
      console.log('TensorFlow.js WASM backend successfully initialized');
    }
    
    return true;
  } catch (error) {
    console.error('WASM backend initialization error:', error);
    NotificationManager.getInstance().show('AI system switched to fallback mode', 'warning');
    
    // Switch to CPU backend
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      return true;
    } catch (fallbackError) {
      console.error('Fallback backend initialization failed:', fallbackError);
      return false;
    }
  }
}

// Model check
async function checkModels(): Promise<boolean> {
  try {
    await tf.loadLayersModel('localstorage://enemy-selection-model');
    await tf.loadLayersModel('localstorage://structure-placement-model');
    console.log('AI models loaded');
    return true;
  } catch (error) {
    console.warn('Models not found, training will start:', error);
    ErrorManager.getInstance().handleError(error as Error, 'checkModels');
    return false;
  }
}

// Model training
async function trainModelsSafely(): Promise<boolean> {
  try {
    const canvas = document.querySelector('#webgl-canvas') as HTMLCanvasElement;
    const scene = new THREE.Scene();
    const modelsLoader = new ModelsLoader(scene);
    await trainModels(modelsLoader);
    NotificationManager.getInstance().show('AI models ready!', 'success');
    return true;
  } catch (error) {
    ErrorManager.getInstance().handleError(error as Error, 'trainModelsSafely');
    return false;
  }
}

// Wait for canvas element
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
          reject(new Error('Canvas element not found!'));
        } else {
          setTimeout(checkCanvas, 100);
        }
      }
    }

    checkCanvas();
  });
}

// Main application startup
async function main() {
  try {
    // Wait for canvas element
    const canvas = await waitForCanvas();
    
    // Initialize WASM backend
    const tfInitialized = await initTensorFlow();
    if (!tfInitialized) {
      throw new Error('TensorFlow initialization failed');
    }

    // Model check and training
    const modelsExist = await checkModels();
    if (!modelsExist) {
      NotificationManager.getInstance().show('AI models training...', 'warning');
      const modelsTrained = await trainModelsSafely();
      if (!modelsTrained) {
        throw new Error('Model training failed');
      }
    }

    // Start game
    const game = new Game(canvas);
    NotificationManager.getInstance().show('Welcome!', 'success');
  } catch (error) {
    console.error('Application startup error:', error);
    NotificationManager.getInstance().show('Game startup failed!', 'error');
    ErrorManager.getInstance().handleError(error as Error, 'main');
  }
}

// Start application when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

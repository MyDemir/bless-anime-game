// src/core/main.ts

import { Game } from './Game';
import { NotificationManager } from './NotificationManager';

// Global bildirim fonksiyonu
(window as any).showNotification = (message: string, type: 'success' | 'error' | 'warning' = 'success', duration: number = 3000) => {
    NotificationManager.getInstance().show(message, type, duration);
};

// Oyun başlatma
window.addEventListener('load', () => {
    console.log("Sayfa yüklendi");
    const canvas = document.querySelector('#webgl-canvas');
    if (canvas instanceof HTMLCanvasElement) {
        const game = new Game(canvas);
        NotificationManager.getInstance().show('Hoş geldin!', 'success');
    } else {
        console.error('Canvas elementi bulunamadı!');
        NotificationManager.getInstance().show('Oyun başlatılamadı!', 'error');
    }
});

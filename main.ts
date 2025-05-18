import WebServer from '@blockless/sdk-ts/dist/lib/web';
import { Game } from './Game';

// Web sunucusunu başlat
const server = new WebServer();
server.statics('public', '/'); // public/ dizinini kök olarak sun
server.start();

// Bildirim sistemini yönetecek sınıf
class NotificationManager {
    private static instance: NotificationManager;
    private queue: { message: string; type: string; duration: number }[] = [];
    private isShowing = false;

    private constructor() { }

    static getInstance(): NotificationManager {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    show(message: string, type: 'success' | 'error' | 'warning' = 'success', duration: number = 3000): void {
        this.queue.push({ message, type, duration });
        if (!this.isShowing) {
            this.processQueue();
        }
    }

    private processQueue(): void {
        if (this.queue.length === 0) {
            this.isShowing = false;
            return;
        }

        this.isShowing = true;
        const { message, type, duration } = this.queue.shift()!;
        
        const notification = document.getElementById('notification');
        const messageEl = notification?.querySelector('.notification-message');
        const iconEl = notification?.querySelector('.notification-icon');
        const closeBtn = notification?.querySelector('.notification-close');
        
        if (!notification || !messageEl || !iconEl) {
            this.isShowing = false;
            return;
        }

        // İkon ve renk ayarları
        let icon = '✓';
        notification.className = 'notification';
        switch(type) {
            case 'success':
                icon = '✓';
                notification.classList.add('success');
                break;
            case 'error':
                icon = '✕';
                notification.classList.add('error');
                break;
            case 'warning':
                icon = '!';
                notification.classList.add('warning');
                break;
        }

        // İçeriği ayarla
        iconEl.textContent = icon;
        messageEl.textContent = message;

        // Kapat butonunu ayarla
        if (closeBtn instanceof HTMLElement) {
            closeBtn.addEventListener('click', () => {
                notification.classList.add('slide-out');
                setTimeout(() => {
                    notification.classList.remove('slide-in', 'slide-out');
                    this.processQueue();
                }, 300);
            });
        }

        // Animasyonları uygula
        notification.classList.add('slide-in');

        // Otomatik kapanma
        setTimeout(() => {
            if (notification.classList.contains('slide-in')) {
                notification.classList.add('slide-out');
                setTimeout(() => {
                    notification.classList.remove('slide-in', 'slide-out');
                    this.processQueue();
                }, 300);
            }
        }, duration);
    }
}

// Global bildirim fonksiyonu
(window as any).showNotification = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    NotificationManager.getInstance().show(message, type);
};

// Ana oyun başlatma kodu
const canvas = document.querySelector('canvas#webgl-canvas');
if (canvas instanceof HTMLCanvasElement) {
    const game = new Game(canvas);
    
    // Oyun yüklendiğinde hoş geldin bildirimi
    setTimeout(() => {
        NotificationManager.getInstance().show(
            `Hoş geldin ${game.getCurrentUser()}! Son oynama: ${game.getLastPlayTime()}`,
            'success'
        );
    }, 1000);
} else {
    console.error('Canvas elementi bulunamadı!');
    NotificationManager.getInstance().show('Oyun başlatılamadı!', 'error');
}

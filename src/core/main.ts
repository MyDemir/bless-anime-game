import { Game } from './Game';
import { EventEmitter } from '../utils/EventEmitter';

// Bildirim sistemi
class NotificationManager {
    private static instance: NotificationManager;
    private queue: { message: string; type: string; duration: number }[] = [];
    private isShowing = false;

    private constructor() {}

    static getInstance(): NotificationManager {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    show(message: string, type: 'success' | 'error' | 'warning' = 'success', duration: number = 3000): void {
        console.log(`Bildirim: ${message}, Tip: ${type}, Süre: ${duration}`);
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
            console.error('Bildirim elementi eksik!');
            this.isShowing = false;
            return;
        }

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

        iconEl.textContent = icon;
        messageEl.textContent = message;

        if (closeBtn instanceof HTMLElement) {
            closeBtn.addEventListener('click', () => {
                notification.classList.add('slide-out');
                setTimeout(() => {
                    notification.classList.remove('slide-in', 'slide-out');
                    this.processQueue();
                }, 300);
            });
        }

        notification.classList.add('slide-in');

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

// Menü işlemleri
function setupMenu(emitter: EventEmitter) {
    console.log("Menü ayarlanıyor");
    const startBtn = document.getElementById('startBtn');
    const characterSelectBtn = document.getElementById('characterSelectBtn');
    const scoreboardBtn = document.getElementById('scoreboardBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const mainMenu = document.getElementById('main-menu');
    const characterSelect = document.getElementById('character-select');
    const scoreboard = document.getElementById('scoreboard');
    const settings = document.getElementById('settings');

    startBtn?.addEventListener('click', () => {
        console.log("Oyun başlat düğmesine tıklandı");
        mainMenu?.classList.add('hidden');
        document.getElementById('ui')?.classList.remove('hidden');
        emitter.emit('startGame');
    });

    characterSelectBtn?.addEventListener('click', () => {
        console.log("Karakter seçimi açılıyor");
        mainMenu?.classList.add('hidden');
        characterSelect?.classList.remove('hidden');
    });

    scoreboardBtn?.addEventListener('click', () => {
        console.log("Skor tablosu açılıyor");
        mainMenu?.classList.add('hidden');
        scoreboard?.classList.remove('hidden');
    });

    settingsBtn?.addEventListener('click', () => {
        console.log("Ayarlar açılıyor");
        mainMenu?.classList.add('hidden');
        settings?.classList.remove('hidden');
    });
}

// Oyun başlatma
function startGame(emitter: EventEmitter) {
    console.log("Oyun başlatılıyor");
    const canvas = document.querySelector('#webgl-canvas');
    if (canvas instanceof HTMLCanvasElement) {
        const game = new Game(canvas);
        game.startGame();
        NotificationManager.getInstance().show('Oyun başladı!', 'success');
        emitter.emit('gameStarted', game);
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
}

// Başlat
window.addEventListener('load', () => {
    console.log("Sayfa yüklendi");
    const emitter = new EventEmitter();
    setupMenu(emitter);
    emitter.on('startGame', () => startGame(emitter));
    NotificationManager.getInstance().show('Hoş geldin!', 'success');
});

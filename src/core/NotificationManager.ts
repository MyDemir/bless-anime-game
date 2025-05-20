// src/core/NotificationManager.ts

export class NotificationManager {
    private static instance: NotificationManager;
    private queue: { message: string; type: string; duration: number }[] = [];
    private isShowing = false;

    private constructor() {
        console.log("NotificationManager başlatılıyor");
    }

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
            }, { once: true });
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

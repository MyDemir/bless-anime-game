import { NotificationManager } from './NotificationManager';

export class ErrorManager {
    private static instance: ErrorManager;
    
    private constructor() {}
    
    static getInstance(): ErrorManager {
        if (!ErrorManager.instance) {
            ErrorManager.instance = new ErrorManager();
        }
        return ErrorManager.instance;
    }
    
    handleError(error: Error, context: string): void {
        console.error(`[${context}]`, error);
        NotificationManager.getInstance().show(
            `Hata: ${context} - ${error.message}`,
            'error'
        );
        
        this.logError(error, context);
    }
    
    private logError(error: Error, context: string): void {
        const errorLog = {
            timestamp: new Date().toISOString(),
            context,
            error: {
                message: error.message,
                stack: error.stack
            }
        };
        
        // Local storage'a log kaydett
        const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
        logs.push(errorLog);
        if (logs.length > 100) logs.shift(); // Maksimum 100 log tut
        localStorage.setItem('errorLogs', JSON.stringify(logs));
    }

    clearLogs(): void {
        localStorage.removeItem('errorLogs');
    }

    getLogs(): any[] {
        return JSON.parse(localStorage.getItem('errorLogs') || '[]');
    }
}

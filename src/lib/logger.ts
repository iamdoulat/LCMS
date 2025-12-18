// Enhanced logger with Sentry integration (optional)
// Install: npm install @sentry/nextjs

type LogLevel = 'debug' | 'info' | 'warn' | 'warning' | 'error';

interface LogContext {
    [key: string]: any;
}

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development';
    private isProduction = process.env.NODE_ENV === 'production';

    /**
     * Log debug information (development only)
     */
    debug(message: string, context?: LogContext) {
        if (this.isDevelopment) {
            console.log(`[DEBUG] ${message}`, context || '');
        }
    }

    /**
     * Log informational messages
     */
    info(message: string, context?: LogContext) {
        if (!this.isProduction) {
            console.info(`[INFO] ${message}`, context || '');
        }
    }

    /**
     * Log warnings
     */
    warn(message: string, context?: LogContext) {
        console.warn(`[WARN] ${message}`, context || '');

        // In production, send to monitoring service
        if (this.isProduction && typeof window !== 'undefined') {
            this.sendToMonitoring('warning', message, context);
        }
    }

    /**
     * Log errors
     */
    error(message: string, error?: Error, context?: LogContext) {
        console.error(`[ERROR] ${message}`, error || '', context || '');

        // In production, send to monitoring service
        if (this.isProduction && typeof window !== 'undefined') {
            this.sendToMonitoring('error', message, { ...context, error: error?.stack });
        }
    }

    /**
     * Send log to monitoring service (Sentry, LogRocket, etc.)
     */
    private sendToMonitoring(level: LogLevel, message: string, context?: LogContext) {
        // TODO: Integrate with your monitoring service
        // Example for Sentry:
        // import * as Sentry from '@sentry/nextjs';
        // Sentry.captureMessage(message, {
        //   level,
        //   extra: context,
        // });

        // For now, just use console.error in production
        if (level === 'error') {
            // This will be caught by monitoring tools
            console.error(`[MONITORING] ${level.toUpperCase()}: ${message}`, context);
        }
    }

    /**
     * Log API request/response for debugging
     */
    api(endpoint: string, method: string, status: number, duration?: number) {
        if (!this.isProduction) {
            console.log(`[API] ${method} ${endpoint} - ${status} ${duration ? `(${duration}ms)` : ''}`);
        }
    }

    /**
     * Log user actions for analytics
     */
    userAction(action: string, details?: LogContext) {
        if (!this.isProduction) {
            console.log(`[USER ACTION] ${action}`, details || '');
        }

        // TODO: Send to analytics service (Google Analytics, Mixpanel, etc.)
    }

    /**
     * Log performance metrics
     */
    performance(metric: string, value: number, context?: LogContext) {
        if (!this.isProduction) {
            console.log(`[PERFORMANCE] ${metric}: ${value}ms`, context || '');
        }

        // TODO: Send to performance monitoring
    }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing
export { Logger };

/**
 * Example usage:
 * 
 * import { logger } from '@/lib/logger';
 * 
 * // Debug logging (dev only)
 * logger.debug('User data loaded', { userId: 123 });
 * 
 * // Error logging
 * logger.error('Failed to save data', error, { userId: 123, action: 'save' });
 * 
 * // API logging
 * logger.api('/api/users', 'GET', 200, 150);
 * 
 * // User action tracking
 * logger.userAction('button_click', { buttonId: 'submit-form' });
 */

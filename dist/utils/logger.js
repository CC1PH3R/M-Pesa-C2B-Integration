"use strict";
/**
 * Simple logger utility for debugging and monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
const logger = {
    info: (message, data = {}) => {
        console.log(JSON.stringify({
            level: 'INFO',
            timestamp: new Date().toISOString(),
            message,
            ...data,
        }));
    },
    error: (message, error = {}) => {
        const err = error;
        console.error(JSON.stringify({
            level: 'ERROR',
            timestamp: new Date().toISOString(),
            message,
            error: err.message ?? error,
            stack: err.stack,
        }));
    },
    warn: (message, data = {}) => {
        console.warn(JSON.stringify({
            level: 'WARN',
            timestamp: new Date().toISOString(),
            message,
            ...data,
        }));
    },
    debug: (message, data = {}) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(JSON.stringify({
                level: 'DEBUG',
                timestamp: new Date().toISOString(),
                message,
                ...data,
            }));
        }
    },
};
exports.default = logger;

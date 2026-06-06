"use strict";
/**
 * M-Pesa C2B Test Application Server
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const mpesa_routes_1 = __importDefault(require("./routes/mpesa.routes"));
const mpesa_1 = __importDefault(require("./config/mpesa"));
const logger_1 = __importDefault(require("./utils/logger"));
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 3000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)('combined'));
// Request logging
app.use((req, _res, next) => {
    logger_1.default.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
    });
    next();
});
// Routes
// Using '/api/ganji' instead of '/api/mpesa' to comply with Daraja C2B URL restrictions
app.use('/api/ganji', mpesa_routes_1.default);
// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        success: true,
        message: 'M-Pesa C2B Test API',
        version: '1.0.0',
        endpoints: {
            health: '/api/ganji/health',
            register: 'POST /api/ganji/register',
            transactions: 'GET /api/ganji/transactions',
            simulate: 'POST /api/ganji/simulate',
        },
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
    });
});
// Error handler
app.use((err, _req, res, _next) => {
    logger_1.default.error('Server error', err);
    res.status(err.status ?? 500).json({
        success: false,
        message: err.message ?? 'Internal server error',
    });
});
// Start server
async function startServer() {
    try {
        // Validate M-Pesa configuration
        mpesa_1.default.validate();
        logger_1.default.info('M-Pesa configuration validated');
        app.listen(PORT, () => {
            logger_1.default.info('Server started successfully', {
                port: PORT,
                environment: process.env.NODE_ENV,
                baseURL: mpesa_1.default.appBaseURL,
            });
            logger_1.default.info('Server ready to receive M-Pesa callbacks', {
                confirmation: mpesa_1.default.getCallbackURLs().confirmation,
            });
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server', error);
        process.exit(1);
    }
}
// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.default.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});
startServer();

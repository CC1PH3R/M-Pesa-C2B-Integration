"use strict";
/**
 * M-Pesa API Routes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mpesaController_1 = __importDefault(require("../controllers/mpesaController"));
const mpesa_1 = __importDefault(require("../config/mpesa"));
const router = (0, express_1.Router)();
// Health check
router.get('/health', (req, res) => mpesaController_1.default.health(req, res));
// Debug credentials (remove after testing)
router.get('/debug-config', (_req, res) => {
    res.json({
        consumerKey: {
            exists: !!mpesa_1.default.consumerKey,
            length: mpesa_1.default.consumerKey?.length,
            first10: mpesa_1.default.consumerKey?.substring(0, 10),
            last10: mpesa_1.default.consumerKey?.substring((mpesa_1.default.consumerKey?.length ?? 0) - 10),
            hasWhitespace: /\s/.test(mpesa_1.default.consumerKey ?? ''),
        },
        consumerSecret: {
            exists: !!mpesa_1.default.consumerSecret,
            length: mpesa_1.default.consumerSecret?.length,
            first10: mpesa_1.default.consumerSecret?.substring(0, 10),
            last10: mpesa_1.default.consumerSecret?.substring((mpesa_1.default.consumerSecret?.length ?? 0) - 10),
            hasWhitespace: /\s/.test(mpesa_1.default.consumerSecret ?? ''),
        },
        shortcode: mpesa_1.default.shortcode,
        baseURL: mpesa_1.default.baseURL,
        appBaseURL: mpesa_1.default.appBaseURL,
        authEndpoint: `${mpesa_1.default.baseURL}${mpesa_1.default.endpoints.auth}`,
        registerEndpoint: `${mpesa_1.default.baseURL}${mpesa_1.default.endpoints.c2bRegister}`,
    });
});
// Test authentication
router.get('/test-auth', (req, res) => mpesaController_1.default.testAuth(req, res));
// Register C2B URLs with M-Pesa
router.post('/register', (req, res) => mpesaController_1.default.registerUrls(req, res));
// M-Pesa Callbacks (these will be called by M-Pesa)
router.post('/confirmation', (req, res) => mpesaController_1.default.confirmation(req, res));
// Transaction management endpoints
router.get('/transactions', (req, res) => mpesaController_1.default.getTransactions(req, res));
router.get('/transactions/:transID', (req, res) => mpesaController_1.default.getTransaction(req, res));
// Simulate payment (for testing)
router.post('/simulate', (req, res) => mpesaController_1.default.simulate(req, res));
exports.default = router;

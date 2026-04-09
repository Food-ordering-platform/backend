"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const pg_1 = require("pg");
const compression_1 = __importDefault(require("compression"));
const swagger_1 = require("./swagger");
const Sentry = __importStar(require("@sentry/node")); // Sentry import
const profiling_node_1 = require("@sentry/profiling-node");
const cookie_parser_1 = __importDefault(require("cookie-parser")); // import { globalLimiter } from "./config/rate-limit";
const auth_route_1 = __importDefault(require("./auth/auth.route"));
const restaurant_route_1 = __importDefault(require("./restuarant/restaurant.route"));
const order_route_1 = __importDefault(require("./order/order.route"));
const payment_route_1 = __importDefault(require("./payment/payment.route"));
const admin_route_1 = __importDefault(require("./admin/admin.route"));
const rider_route_1 = __importDefault(require("./rider/rider.route"));
const vendor_route_1 = __importDefault(require("./vendor/vendor.route"));
const app = (0, express_1.default)();
// 1. Initialize Sentry early
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
        (0, profiling_node_1.nodeProfilingIntegration)(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
});
app.set("trust proxy", 1); //Tells express to trust the load balancer
// 1. Setup Session Store (Postgres)
const PgStore = (0, connect_pg_simple_1.default)(express_session_1.default);
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
app.use((0, compression_1.default)());
// 2. HYBRID CORS CONFIGURATION (Crucial for Mobile + Web)
// Define your web frontend URLs here. Add your production domain later.
app.use((0, cors_1.default)({
    origin: ["http://localhost:3000", "https://staging.choweazy.com", "https://www.choweazy.com", "https://choweazy.com", "http://localhost:8081", "https://admin.staging.choweazy.com"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    credentials: true,
    optionsSuccessStatus: 204, // This matches the 204 you see in logs
}));
app.use((0, morgan_1.default)("dev"));
(0, swagger_1.setupSwagger)(app);
// 3. JSON Parsing (Skip for Webhooks)
app.use(express_1.default.json({
    verify: (req, res, buf) => {
        // This captures the raw buffer specifically for the webhook signature verification
        if (req.url.startsWith('/api/payment/webhook')) {
            req.rawBody = buf;
        }
    }
}));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// app.use("/api", globalLimiter);
// 5. Routes
app.use("/api/auth", auth_route_1.default);
app.use("/api/restaurant", restaurant_route_1.default);
app.use("/api/orders", order_route_1.default);
app.use("/api/payment", payment_route_1.default);
app.use("/api/rider", rider_route_1.default);
app.use("/api/vendor", vendor_route_1.default);
app.use("/api/admin", admin_route_1.default);
// 6. SENTRY ERROR HANDLER (New v8 Syntax)
// Must be placed after all controllers/routes and before your custom error handler
Sentry.setupExpressErrorHandler(app);
// 6. Global Error Handler
app.use((err, req, res, next) => {
    console.error("🔥 Global Backend Error:", err); // Log error for debugging
    // Handle Multer File Size Error
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            success: false,
            message: "File is too large. Max limit is 5MB.",
        });
    }
    // Handle CORS Errors
    if (err.message && err.message.includes("CORS")) {
        return res.status(403).json({
            success: false,
            message: "CORS Error: Origin not allowed",
        });
    }
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map
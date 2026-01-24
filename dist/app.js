"use strict";
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
const auth_route_1 = __importDefault(require("./auth/auth.route"));
const restaurant_route_1 = __importDefault(require("./restuarant/restaurant.route"));
const order_routes_1 = __importDefault(require("./order/order.routes"));
const payment_route_1 = __importDefault(require("./payment/payment.route"));
const dispatch_route_1 = __importDefault(require("./dispatch/dispatch.route"));
const admin_route_1 = __importDefault(require("./admin/admin.route"));
const notification_route_1 = __importDefault(require("./notifications/notification.route"));
const app = (0, express_1.default)();
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
    origin: ["http://localhost:3000", "https://choweazy.vercel.app", "http://localhost:8081", "https://choweazy-vendor.vercel.app", "https://choweazy-rider.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    credentials: true,
    optionsSuccessStatus: 204, // This matches the 204 you see in logs
}));
app.use((0, morgan_1.default)("dev"));
// 3. JSON Parsing (Skip for Webhooks)
app.use((req, res, next) => {
    if (req.path.startsWith("/api/payment/webhook")) {
        next();
    }
    else {
        express_1.default.json()(req, res, next);
    }
});
app.use(express_1.default.urlencoded({ extended: true }));
// 5. Routes
app.use("/api/auth", auth_route_1.default);
app.use("/api/restaurant", restaurant_route_1.default);
app.use("/api/orders", order_routes_1.default);
app.use("/api/payment", payment_route_1.default);
app.use("/api/dispatch", dispatch_route_1.default);
app.use("/api/admin", admin_route_1.default);
app.use("/api/notifications", notification_route_1.default);
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
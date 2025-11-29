"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const auth_route_1 = __importDefault(require("./auth/auth.route"));
const restaurant_route_1 = __importDefault(require("./restuarant/restaurant.route"));
const order_routes_1 = __importDefault(require("./order/order.routes"));
const payment_route_1 = __importDefault(require("./payment/payment.route"));
const app = (0, express_1.default)();
// Middlewares
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)("dev"));
// Apply express.json() only to specific routes (excluding /api/payment/webhook)
app.use((req, res, next) => {
    if (req.path.startsWith("/api/payment/webhook")) {
        next(); // Skip JSON parsing for webhook
    }
    else {
        express_1.default.json()(req, res, next); // Apply JSON parsing for other routes
    }
});
app.use("/api/auth", auth_route_1.default);
app.use("/api/restaurant", restaurant_route_1.default);
app.use("/api/orders", order_routes_1.default);
app.use("/api/payment", payment_route_1.default);
exports.default = app;
//# sourceMappingURL=app.js.map
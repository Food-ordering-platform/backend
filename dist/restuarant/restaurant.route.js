"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const restaurant_controller_1 = require("./restaurant.controller");
const upload_middleware_1 = require("./upload.middleware");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
// === PUBLIC ROUTES (Anyone can see menu/restaurants) ===
router.get("/", restaurant_controller_1.RestaurantController.getAllRestaurants);
router.get("/:id", restaurant_controller_1.RestaurantController.getRestaurantById);
router.get("/:id/menu", restaurant_controller_1.RestaurantController.getMenuItems);
// === PROTECTED ROUTES (Only Owners/Admin) ===
// 1. Create Restaurant
router.post("/", auth_middleware_1.authMiddleware, upload_middleware_1.upload.single("image"), restaurant_controller_1.RestaurantController.createRestaurant);
// 2. Update Restaurant Details
router.post("/:id", auth_middleware_1.authMiddleware, upload_middleware_1.upload.single("image"), restaurant_controller_1.RestaurantController.updateRestaurant);
// 3. Add Menu Item
router.post("/:id/menu", auth_middleware_1.authMiddleware, upload_middleware_1.upload.single("image"), restaurant_controller_1.RestaurantController.addMenuItem);
// 4. Update Menu Item
router.put("/menu/:id", auth_middleware_1.authMiddleware, restaurant_controller_1.RestaurantController.updateMenuItem);
// 5. Delete Menu Item
router.delete("/menu/:id", auth_middleware_1.authMiddleware, restaurant_controller_1.RestaurantController.deleteMenuItem);
// 6. Toggle Availability (Stock)
router.patch("/menu/:id/toggle", auth_middleware_1.authMiddleware, restaurant_controller_1.RestaurantController.toggleMenuItemAvailability);
// 7. View Earnings (Strictly Private)
router.get("/:id/earnings", auth_middleware_1.authMiddleware, restaurant_controller_1.RestaurantController.getEarnings);
//8. View Recent Transactions
router.get("/:id/transactions", auth_middleware_1.authMiddleware, restaurant_controller_1.RestaurantController.getTransactions);
//9. Withdraw Money
// [FIXED] Route name changed to match frontend service call (/payout)
router.post("/:id/payout", auth_middleware_1.authMiddleware, restaurant_controller_1.RestaurantController.requestPayout);
exports.default = router;
//# sourceMappingURL=restaurant.route.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const restaurant_controller_1 = require("./restaurant.controller");
const router = (0, express_1.Router)();
// Restaurant
router.get("/", restaurant_controller_1.RestaurantController.getAllRestaurants);
router.get("/:id", restaurant_controller_1.RestaurantController.getRestaurantById);
router.put("/:id", restaurant_controller_1.RestaurantController.updateRestaurant);
// Menu Management
router.get("/:id/menu", restaurant_controller_1.RestaurantController.getMenuItems);
router.post("/:id/menu", restaurant_controller_1.RestaurantController.addMenuItem);
router.put("/menu/:id", restaurant_controller_1.RestaurantController.updateMenuItem);
router.delete("/menu/:id", restaurant_controller_1.RestaurantController.deleteMenuItem);
router.patch("/menu/:id/toggle", restaurant_controller_1.RestaurantController.toggleMenuItemAvailability);
exports.default = router;
//# sourceMappingURL=restaurant.route.js.map
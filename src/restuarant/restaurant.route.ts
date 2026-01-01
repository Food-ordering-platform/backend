import { Router } from "express";
import { RestaurantController } from "./restaurant.controller";
import { upload } from "./upload.middleware";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

// === PUBLIC ROUTES (Anyone can see menu/restaurants) ===
router.get("/", RestaurantController.getAllRestaurants);
router.get("/:id", RestaurantController.getRestaurantById);
router.get("/:id/menu", RestaurantController.getMenuItems);

// === PROTECTED ROUTES (Only Owners/Admin) ===

// 1. Create Restaurant
router.post("/", authMiddleware, upload.single("image"), RestaurantController.createRestaurant);

// 2. Update Restaurant Details
router.post("/:id", authMiddleware, upload.single("image"), RestaurantController.updateRestaurant);

// 3. Add Menu Item
router.post("/:id/menu", authMiddleware, upload.single("image"), RestaurantController.addMenuItem);

// 4. Update Menu Item
router.put("/menu/:id", authMiddleware, RestaurantController.updateMenuItem);

// 5. Delete Menu Item
router.delete("/menu/:id", authMiddleware, RestaurantController.deleteMenuItem);

// 6. Toggle Availability (Stock)
router.patch("/menu/:id/toggle", authMiddleware, RestaurantController.toggleMenuItemAvailability);

// 7. View Earnings (Strictly Private)
router.get("/:id/earnings", authMiddleware, RestaurantController.getEarnings);

//8. View Recent Transactions
router.get("/:id/transactions", authMiddleware, RestaurantController.getTransactions)

export default router;
import { Router } from "express";
import { RestaurantController } from "./restaurant.controller";
import { upload } from "./upload.middleware";

const router = Router();

// Restaurant
router.get("/", RestaurantController.getAllRestaurants);
router.get("/:id", RestaurantController.getRestaurantById);

// Menu Management
router.get("/:id/menu", RestaurantController.getMenuItems);
router.post(
  "/:id/menu", 
  upload.single("image"), 
  RestaurantController.addMenuItem
);

// ✅ KEEP THIS ONE (It has the upload middleware)
router.put(
  "/:id", 
  upload.single("image"), 
  RestaurantController.updateRestaurant
);

// Create Restaurant
router.post(
  "/", 
  upload.single("image"), 
  RestaurantController.createRestaurant
);

router.put("/menu/:id", RestaurantController.updateMenuItem);
router.delete("/menu/:id", RestaurantController.deleteMenuItem);
router.patch("/menu/:id/toggle", RestaurantController.toggleMenuItemAvailability);

export default router;
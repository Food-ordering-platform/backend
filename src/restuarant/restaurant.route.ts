import { Router } from "express";
import { RestaurantController } from "./restaurant.controller";
import { upload } from "./upload.middleware";

const router = Router();

// Restaurant
router.get("/", RestaurantController.getAllRestaurants);
router.get("/:id", RestaurantController.getRestaurantById);
router.put("/:id", RestaurantController.updateRestaurant);

// Menu Management
router.get("/:id/menu", RestaurantController.getMenuItems);
router.post(
  "/:id/menu", 
  upload.single("image"), // "image" must match the name in your FormData on frontend
  RestaurantController.addMenuItem
);
//Create restaurant
router.post("/", RestaurantController.createRestaurant);

router.put("/menu/:id", RestaurantController.updateMenuItem);
router.delete("/menu/:id", RestaurantController.deleteMenuItem);
router.patch("/menu/:id/toggle", RestaurantController.toggleMenuItemAvailability);

export default router;

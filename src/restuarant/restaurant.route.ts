import { Router } from "express";
import { RestaurantController } from "./restaurant.controller";

const router = Router();

router.get("/", RestaurantController.getAllRestaurants);
router.get("/:id", RestaurantController.getRestaurantById)

export default router
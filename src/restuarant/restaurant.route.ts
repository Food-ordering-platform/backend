import { Router } from "express";
import { RestaurantController } from "./restaurant.controller";
import { upload } from "./upload.middleware";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Restaurants
 *   description: Restaurant profiles, menus, and availability
 */

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────

/**
 * @swagger
 * /restaurants:
 *   get:
 *     summary: Get all restaurants
 *     tags: [Restaurants]
 *     responses:
 *       200:
 *         description: List of all restaurants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RestaurantSummary'
 *       500:
 *         description: Failed to fetch restaurants
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", RestaurantController.getAllRestaurants);

/**
 * @swagger
 * /restaurants/{id}:
 *   get:
 *     summary: Get a restaurant by ID including its full menu
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The restaurant ID
 *         example: clxyz456def
 *     responses:
 *       200:
 *         description: Restaurant with categories and menu items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RestaurantDetail'
 *       404:
 *         description: Restaurant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id", RestaurantController.getRestaurantById);

/**
 * @swagger
 * /restaurants/{id}/menu:
 *   get:
 *     summary: Get all menu items for a restaurant
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The restaurant ID
 *         example: clxyz456def
 *     responses:
 *       200:
 *         description: List of menu items with their categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MenuItem'
 *       500:
 *         description: Failed to fetch menu items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id/menu", RestaurantController.getMenuItems);

// ─────────────────────────────────────────────
// PROTECTED ROUTES
// ─────────────────────────────────────────────

/**
 * @swagger
 * /restaurants:
 *   post:
 *     summary: Create a restaurant profile for the authenticated vendor
 *     description: Each vendor can only have one restaurant. Ownership is derived from the JWT — no ownerId needed in the body.
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *               - phone
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 example: Mama's Kitchen
 *               address:
 *                 type: string
 *                 example: 5 Food Court, Lekki, Lagos
 *               phone:
 *                 type: string
 *                 example: "+2348099999999"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: mamas@kitchen.com
 *               prepTime:
 *                 type: integer
 *                 description: Average preparation time in minutes (defaults to 20)
 *                 example: 25
 *               minimumOrder:
 *                 type: number
 *                 description: Minimum order amount in Naira (defaults to 0)
 *                 example: 1500
 *               isOpen:
 *                 type: boolean
 *                 description: Whether the restaurant is currently accepting orders (defaults to true)
 *                 example: true
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 6.4281
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 3.4219
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Restaurant cover image (uploaded to Cloudinary)
 *     responses:
 *       201:
 *         description: Restaurant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Restaurant Profile Created Successfully
 *                 data:
 *                   $ref: '#/components/schemas/RestaurantSummary'
 *       400:
 *         description: Vendor already has a restaurant, or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: No token provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", authMiddleware, upload.single("image"), RestaurantController.createRestaurant);

/**
 * @swagger
 * /restaurants/{id}:
 *   post:
 *     summary: Update a restaurant's profile
 *     description: Only the restaurant owner can update their profile. All fields are optional — only send what needs to change.
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The restaurant ID
 *         example: clxyz456def
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Mama's Kitchen Updated
 *               address:
 *                 type: string
 *                 example: 10 New Road, Victoria Island
 *               phone:
 *                 type: string
 *                 example: "+2348011111111"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: new@kitchen.com
 *               prepTime:
 *                 type: integer
 *                 example: 30
 *               minimumOrder:
 *                 type: number
 *                 example: 2000
 *               isOpen:
 *                 type: boolean
 *                 example: false
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 6.4281
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 3.4219
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: New cover image (replaces existing)
 *     responses:
 *       200:
 *         description: Restaurant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RestaurantSummary'
 *       403:
 *         description: Authenticated user is not the restaurant owner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Restaurant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/:id", authMiddleware, upload.single("image"), RestaurantController.updateRestaurant);

/**
 * @swagger
 * /restaurants/{id}/menu:
 *   post:
 *     summary: Add a menu item to a restaurant
 *     description: |
 *       You can assign a category in two ways:
 *       - Pass an existing `categoryId` directly
 *       - Pass a `categoryName` string — if it doesn't exist it will be created automatically (case-insensitive match)
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The restaurant ID
 *         example: clxyz456def
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jollof Rice
 *               description:
 *                 type: string
 *                 example: Smoky party jollof with grilled chicken
 *               price:
 *                 type: number
 *                 example: 1500
 *               categoryId:
 *                 type: string
 *                 description: ID of an existing menu category
 *                 example: clxyz111cat
 *               categoryName:
 *                 type: string
 *                 description: Name of a category — creates it if it doesn't exist
 *                 example: Rice Dishes
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Menu item image (uploaded to Cloudinary)
 *     responses:
 *       201:
 *         description: Menu item added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Item added successfully
 *                 data:
 *                   $ref: '#/components/schemas/MenuItem'
 *       500:
 *         description: Restaurant not found, category missing, or server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/:id/menu", authMiddleware, upload.single("image"), RestaurantController.addMenuItem);

/**
 * @swagger
 * /restaurants/menu/{id}:
 *   put:
 *     summary: Update a menu item
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The menu item ID
 *         example: clxyz789ghi
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jollof Rice (Large)
 *               description:
 *                 type: string
 *                 example: Updated description
 *               price:
 *                 type: number
 *                 example: 2000
 *               available:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Menu item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/MenuItem'
 *       500:
 *         description: Failed to update item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put("/menu/:id", authMiddleware, RestaurantController.updateMenuItem);

/**
 * @swagger
 * /restaurants/menu/{id}:
 *   delete:
 *     summary: Delete a menu item
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The menu item ID
 *         example: clxyz789ghi
 *     responses:
 *       200:
 *         description: Menu item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Deleted successfully
 *       500:
 *         description: Failed to delete item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete("/menu/:id", authMiddleware, RestaurantController.deleteMenuItem);

/**
 * @swagger
 * /restaurants/menu/{id}/toggle:
 *   patch:
 *     summary: Toggle a menu item's availability (in stock / out of stock)
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The menu item ID
 *         example: clxyz789ghi
 *     responses:
 *       200:
 *         description: Availability toggled — returns updated item with new `available` value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/MenuItem'
 *       500:
 *         description: Menu item not found or server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/menu/:id/toggle", authMiddleware, RestaurantController.toggleMenuItemAvailability);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     RestaurantSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: clxyz456def
 *         name:
 *           type: string
 *           example: Mama's Kitchen
 *         address:
 *           type: string
 *           example: 5 Food Court, Lekki, Lagos
 *         phone:
 *           type: string
 *           example: "+2348099999999"
 *         imageUrl:
 *           type: string
 *           nullable: true
 *           example: https://res.cloudinary.com/example/image/upload/v1/restaurant.jpg
 *         prepTime:
 *           type: integer
 *           example: 25
 *         minimumOrder:
 *           type: number
 *           example: 1500
 *         isOpen:
 *           type: boolean
 *           example: true
 *
 *     RestaurantDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/RestaurantSummary'
 *         - type: object
 *           properties:
 *             rating:
 *               type: number
 *               format: float
 *               example: 4.3
 *             ratingCount:
 *               type: integer
 *               example: 28
 *             latitude:
 *               type: number
 *               example: 6.4281
 *             longitude:
 *               type: number
 *               example: 3.4219
 *             categories:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: clxyz111cat
 *                   name:
 *                     type: string
 *                     example: Rice Dishes
 *                   menuItems:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/MenuItem'
 *
 *     MenuItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: clxyz789ghi
 *         name:
 *           type: string
 *           example: Jollof Rice
 *         description:
 *           type: string
 *           nullable: true
 *           example: Smoky party jollof with grilled chicken
 *         price:
 *           type: number
 *           example: 1500
 *         imageUrl:
 *           type: string
 *           nullable: true
 *           example: https://res.cloudinary.com/example/image/upload/v1/jollof.jpg
 *         available:
 *           type: boolean
 *           example: true
 *         restaurantId:
 *           type: string
 *           example: clxyz456def
 *         categoryId:
 *           type: string
 *           example: clxyz111cat
 *         category:
 *           type: object
 *           nullable: true
 *           description: Populated when fetched via getMenuItems
 *           properties:
 *             id:
 *               type: string
 *               example: clxyz111cat
 *             name:
 *               type: string
 *               example: Rice Dishes
 */
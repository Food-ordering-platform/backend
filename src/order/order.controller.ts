import { Request, Response } from "express";
import { OrderService } from "./order.service";

export class OrderController {
  // Create a new order AND initialize payment
  static async createOrder(req: Request, res: Response) {
    try {
      const { customerId, restaurantId, totalAmount, deliveryAddress, items, name, email } =
        req.body;

      // Validate required fields
      if (!customerId || !restaurantId || !totalAmount || !deliveryAddress || !items || !name || !email) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      // Create order and initialize payment
      const { order, checkoutUrl } = await OrderService.createOrderWithPayment(
        customerId,
        restaurantId,
        totalAmount,
        deliveryAddress,
        items,
        name,
        email
      );

      return res.status(201).json({
        success: true,
        data: {
          orderId: order.id,
          reference: order.reference,
          checkoutUrl,
        },
      });
    } catch (err: any) {
      console.error("create order error", err);
      return res.status(500).json({ success: false, message: err.message || "Server Error" });
    }
  }

  // Get all orders from a customer
  static async getAllOrders(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      if (!customerId) return res.status(400).json({ success: false, message: "CustomerId is required" });

      const orders = await OrderService.getOrdersByCustomer(customerId);
      return res.status(200).json({ success: true, data: orders });
    } catch (err: any) {
      console.error("Get orders error:", err);
      return res.status(500).json({ success: false, message: err.message || "Server Error" });
    }
  }

  // Get a single order by order item ID
  static async getSingleOrderById(req: Request, res: Response) {
    try {
      const { orderItemId } = req.params;
      if (!orderItemId) return res.status(400).json({ success: false, message: "OrderId is missing" });

      const order = await OrderService.getOrderById(orderItemId);
      if (!order) return res.status(404).json({ success: false, message: "Order not found" });

      return res.status(200).json({ success: true, data: order });
    } catch (err: any) {
      console.error("Get particular order error:", err.message);
      return res.status(500).json({ success: false, message: err.message || "Server Error" });
    }
  }
}

import { Request, Response } from "express";
import { OrderService } from "./order.service";
import { RestaurantService } from "../restuarant/restaurant.service";

export class OrderController {
  
  // ✅ NEW: Calculate Quote
  static async getQuote(req: Request, res: Response) {
    try {
        const { restaurantId, deliveryLatitude, deliveryLongitude, items } = req.body;

        if (!restaurantId || !deliveryLatitude || !deliveryLongitude || !items) {
            return res.status(400).json({ success: false, message: "Missing location or items for quote" });
        }

        const quote = await OrderService.getOrderQuote(
            restaurantId, 
            deliveryLatitude, 
            deliveryLongitude, 
            items
        );

        return res.status(200).json({ success: true, data: quote });

    } catch (err: any) {
        console.error("Quote error", err);
        return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Create a new order AND initialize payment
  static async createOrder(req: Request, res: Response) {
    try {
      const { 
        customerId, 
        restaurantId, 
        deliveryAddress, 
        deliveryPhoneNumber,
        deliveryNotes, 
        deliveryLatitude,
        deliveryLongitude,
        items, 
        name, 
        email,
        idempotencyKey: bodyKey 
      } = req.body;

      const headerKey = req.headers['idempotency-key'] as string;
      const idempotencyKey = bodyKey || headerKey;

      if (!customerId || !restaurantId || !deliveryAddress || !items || !name || !email) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const { order, checkoutUrl } = await OrderService.createOrderWithPayment(
        customerId,
        restaurantId,
        deliveryAddress,
        deliveryPhoneNumber,
        deliveryNotes, 
        deliveryLatitude,
        deliveryLongitude,
        items,
        name,
        email,
        idempotencyKey
      );

      return res.status(201).json({
        success: true,
        data: {
          orderId: order.id,
          reference: order.reference,
          token: order.token, 
          checkoutUrl,
          amounts: {
            total: order.totalAmount,
            delivery: order.deliveryFee,
          }
        },
      });
    } catch (err: any) {
      console.error("create order error", err);
      return res.status(500).json({ success: false, message: err.message || "Server Error" });
    }
  }

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

  static async getSingleOrder(req: Request, res: Response) {
    try {
      const { reference } = req.params;
      if (!reference) {
        return res.status(400).json({ success: false, message: "Order reference is required" });
      }

      const order = await OrderService.getOrderByReference(reference);
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      return res.status(200).json({ success: true, data: order });
    } catch (err: any) {
      console.error("Get single order error:", err.message);
      return res.status(500).json({ success: false, message: err.message || "Server Error" });
    }
  }

  // static async getVendorOrders(req: Request, res: Response) {
  //   try {
  //     const { restaurantId } = req.params;
  //     if (!restaurantId) {
  //       return res.status(400).json({ success: false, message: "Restaurant ID is required" });
  //     }
  //     const orders = await OrderService.getVendorOrders(restaurantId);
  //     return res.status(200).json({ success: true, data: orders });
  //   }
  //   catch (err: any) {
  //     console.error("Get Vendor orders error", err);
  //     return res.status(500).json({ success: false, message: err.message || "Server Error" });
  //   }
  // }

 

  // static async updateOrderStatus(req: Request, res: Response) {
  //   try {
  //     const { id } = req.params; 
  //     const { status } = req.body;
  //     if (!id || !status) {
  //       return res.status(400).json({ success: false, Message: "OrderID and status is required" });
  //     }
  //     const updateOrder = await OrderService.updateOrderStatus(id, status);
  //     return res.status(200).json({ success: true, data: updateOrder });
  //   }
  //   catch (err: any) {
  //     console.error("Update order status error", err);
  //     const statusCode = err.message.includes("Invalid State Transition") ? 400 : 500;
  //     return res.status(statusCode).json({ success: false, message: err.message || "Server Error" });
  //   }
  // }


  // Add inside OrderController class
static async rateOrder(req: Request, res: Response) {
  try {
    const { id } = req.params; // Order ID
    const { rating, comment } = req.body;
    
    if (!req.user) throw new Error("Unauthorized");    
    const review = await RestaurantService.addReview(req.user.id, id, rating, comment);
    
    return res.status(200).json({ success: true, data: review });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}
}
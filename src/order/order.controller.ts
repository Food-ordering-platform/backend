import { Request, Response } from "express";
import { OrderService } from "./order.service";
import { success } from "zod";
import prisma from "../utils/prisma";

export class OrderController {

  //Create a new Order
  static async createOrder(req: Request, res: Response) {
    try {
      const { customerId, restaurantId, totalAmount, deliveryAddress, items } =
        req.body;

      if (
        !customerId ||
        !restaurantId ||
        !totalAmount ||
        !deliveryAddress ||
        !items
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Missing required Fields" });
      }

      const order = await OrderService.createOrder(
        customerId,
        restaurantId,
        totalAmount,
        deliveryAddress,
        items
      );
      return res.status(201).json({ success: true, data: order });
    } catch (err: any) {
      console.error("create order error", err);
      return res
        .status(500)
        .json({ success: false, message: err.message || "Server Error" });
    }
  }

  //Get all order from a customer
  static async getAllOrders(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      if (!customerId) {
        return res
          .status(400)
          .json({ success: false, message: "CustomerId is required" });
      }

      const orders = await OrderService.getOrdersbyCustomer(customerId);
      return res.status(200).json({ success: true, data: orders });
    } catch (err: any) {
      console.error("Get Orders error:", err);
      return res
        .status(500)
        .json({ success: false, message: err.message || "Server Error" });
    }
  }

  //Get a single order by ID
  static async getSingleOrderbyId(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return res
          .status(400)
          .json({ success: false, message: "OrderId is missing" });
      }

      const order = await OrderService.getOrderbyId(orderId);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      return res.status(200).json({ success: true, data: order });
    } catch (err: any) {
        console.error("Get particular order error: ", err.message)
        return res.status(500).json({success:false, message:err.message || "Serve Error"})
    }
  }
}

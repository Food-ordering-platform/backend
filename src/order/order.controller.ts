import { Request, Response } from "express";
import { OrderService } from "./order.service";
import { success } from "zod";
import { Message } from "node-mailjet";
import prisma from "../utils/prisma";

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
          //Temporal code
          token: order.token,
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

  // Get a single order by reference
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


  //-----------------------MOBILE APP LOGIC FOR VENDOR(GET_VENDOR_ORDERS)-------------------------------------//
  static async getVendorOrders(req:Request, res:Response){
    try{
      const {restaurantId} = req.params; //RestaurantId
      if(!restaurantId){
        return res.status(400).json({success:false, message:"Restaurant ID is required"});
      }
      const orders = await OrderService.getVendorOrders(restaurantId);
      return res.status(200).json({success:true, data:orders})
    }
    catch(err:any){
      console.error("Get Vendor orders error", err)
      return res.status(500).json({success: false, message:err.message || "Server Error"})
    }
  }

  //Update Order Status (i.e ACCEPT, REJECT)
  static async updateOrderStatus(req:Request, res:Response){
    try{
      const {id} = req.params //orderId
      const {status} = req.body
      if(!id || !status){
        return res.status(400).json({success: false, Message:"OrderID and status is required"})
      }
      const updateOrder = await OrderService.updateOrderStatus(id, status)
      return res.status(400).json({success:true, data:updateOrder})
    }
    catch(err:any){
      console.error("Update order status error", err)
      return res.status(500).json({success:true, Message:err.message || "Server Error"})
    }
  }
}

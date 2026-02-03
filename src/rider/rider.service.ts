import { PrismaClient, OrderStatus, TransactionType, TransactionCategory, TransactionStatus } from "@prisma/client";
import { getSocketIO } from "../utils/socket";
import { OrderStateMachine } from "../utils/order-state-machine";

const prisma = new PrismaClient();

export class RiderService {

  /**
   * 1. Fetch all orders ready for pickup.
   * Includes necessary details for the rider to make a decision (Distance, Fees, Items).
   */
  static async getAvailableOrders() {
    return prisma.order.findMany({
      where: {
        status: OrderStatus.READY_FOR_PICKUP,
        riderId: null, // Only orders not yet taken
      },
      select: {
        id: true,
        reference: true,
        totalAmount: true,
        deliveryFee: true,
        createdAt: true,
        restaurant: {
          select: {
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            imageUrl: true,
          }
        },
        customer: {
          select: {
            name: true, // Show first name only maybe? kept full for now
            address: true, // Use deliveryAddress on order preferably, but user address as fallback
          }
        },
        deliveryAddress: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        items: {
            select: {
                quantity: true,
                menuItemName: true
            }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getActiveOrder(riderId: string) {
    return prisma.order.findFirst({
      where: {
        riderId: riderId,
        status: {
          in: [OrderStatus.RIDER_ACCEPTED, OrderStatus.OUT_FOR_DELIVERY] 
        }
      },
      include: {
        restaurant: true,
        customer: true,
        items: true
      }
    });
  }

  /**
   * 2. Accept an Order
   * Locks the order to the specific rider and changes status to RIDER_ACCEPTED.
   */
  static async acceptOrder(riderId: string, orderId: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) throw new Error("Order not found");
      if (order.status !== OrderStatus.READY_FOR_PICKUP) throw new Error("Order is no longer available");
      if (order.riderId) throw new Error("Order has already been taken by another rider");

      // Update Order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.RIDER_ACCEPTED,
          riderId: riderId,
        },
        include: { restaurant: true, customer: true }
      });

      await tx.user.update({ where: { id: riderId }, data: { isOnline: false } });

      // Notify Customer & Vendor
      const io = getSocketIO();
      io.to(`order_${orderId}`).emit("order_update", updatedOrder);
      
      // Remove from the "Available Orders" feed for other riders
      io.to("riders_main_feed").emit("order_taken", { orderId });

      return updatedOrder;
    });
  }

  /**
   * 2b. Reject/Unassign Order
   * If a rider accepts by mistake or cannot fulfill it, they can "reject" it back to the pool.
   * This resets the order to READY_FOR_PICKUP.
   */
  static async rejectOrder(riderId: string, orderId: string, reason?: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) throw new Error("Order not found");
      
      // Ensure the rider requesting rejection is the one assigned
      if (order.riderId !== riderId) throw new Error("You are not assigned to this order");
      
      // Can only reject if it hasn't been picked up yet (Out for Delivery)
      if (order.status !== OrderStatus.RIDER_ACCEPTED) {
        throw new Error("Cannot reject order at this stage. Please contact support.");
      }

      // Reset Order to Pool
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.READY_FOR_PICKUP,
          riderId: null, // Remove assignment
        },
        include: { restaurant: true }
      });

      // Notify System
      console.log(`⚠️ Rider ${riderId} rejected Order ${order.reference}. Reason: ${reason}`);

      // Re-broadcast to all riders
      const io = getSocketIO();
      io.to("riders_main_feed").emit("new_delivery_available", {
          type: "ORDER_RETURNED_TO_POOL",
          order: {
              id: updatedOrder.id,
              reference: updatedOrder.reference,
              restaurantName: updatedOrder.restaurant.name,
              // ... include other necessary fields for the feed
          }
      });
      
      io.to(`order_${orderId}`).emit("order_update", updatedOrder); // Notify Customer status change

      return updatedOrder;
    });
  }

  // ---> NEW METHOD: Handle Pickup & Delivery <---
  static async comfirmPickup(riderId: string, orderId: string, status: OrderStatus) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      
      if (!order) throw new Error("Order not found");
      if (order.riderId !== riderId) throw new Error("Unauthorized");

      // Update the status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.OUT_FOR_DELIVERY },
        include: { restaurant: true, customer: true }
      });

      // If Delivered, mark rider as Online again (Available for new jobs)
      // if (status === OrderStatus.DELIVERED) {
      //    await tx.user.update({ where: { id: riderId }, data: { isOnline: true } });
      // }

      // Notify Customer
      const io = getSocketIO();
      io.to(`order_${orderId}`).emit("order_update", updatedOrder);
      
      return updatedOrder;
    });
  }


  static async confirmDelivery(riderId: string, orderId: string, code: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      
      if (!order) throw new Error("Order not found");
      if (order.riderId !== riderId) throw new Error("Unauthorized access to this order");
      
      // 1. Verify OTP
      // Note: Make sure your order creation logic actually generates this code! 
      // If it's null currently, you might need a fallback or ensure it's generated on order creation.
      if (!order.deliveryCode) throw new Error("System Error: No delivery code generated for this order.");
      
      if (order.deliveryCode !== code) {
        throw new Error("Invalid Delivery Code. Please ask the customer for the correct 4-digit code.");
      }

      // 2. Update Order Status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { 
          status: OrderStatus.DELIVERED,
        },
        include: { restaurant: true, customer: true }
      });

      // 3. Process Payment to Rider (Delivery Fee)
      // We credit the delivery fee to the rider's wallet
      await tx.transaction.create({
        data: {
          userId: riderId,
          amount: order.deliveryFee, // The earning
          type: TransactionType.CREDIT,
          category: TransactionCategory.DELIVERY_FEE,
          status: TransactionStatus.SUCCESS,
          description: `Earnings for Order #${order.reference}`,
          orderId: order.id,
          reference: `EARN-${order.reference}-${Date.now()}`
        }
      });

      // 4. Mark Rider as Online (Available for new jobs)
      await tx.user.update({ 
        where: { id: riderId }, 
        data: { isOnline: true } 
      });

      // 5. Notify Customer & Socket
      const io = getSocketIO();
      io.to(`order_${orderId}`).emit("order_update", updatedOrder);
      
      return updatedOrder;
    });
  }

  

  /**
   * 3. Get Earnings & Wallet Balance
   * Calculates pending balance and returns transaction history.
   */
  static async getRiderEarnings(riderId: string) {
    const transactions = await prisma.transaction.findMany({
      where: { userId: riderId },
      orderBy: { createdAt: 'desc' }
    });

    const totalCredits = transactions
      .filter(t => t.type === TransactionType.CREDIT && t.status === TransactionStatus.SUCCESS)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = transactions
      .filter(t => t.type === TransactionType.DEBIT && (t.status === TransactionStatus.SUCCESS || t.status === TransactionStatus.PENDING))
      .reduce((sum, t) => sum + t.amount, 0);

    const availableBalance = totalCredits - totalDebits;

    return {
      availableBalance,
      totalEarnings: totalCredits,
      withdrawn: totalDebits,
      transactions: transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        category: t.category,
        status: t.status,
        description: t.description,
        date: t.createdAt,
        reference: t.reference
      }))
    };
  }

  /**
   * 4. Request Payout
   * Creates a withdrawal request (Debit Transaction).
   */
  static async requestPayout(riderId: string, amount: number) {
    // 1. Check Balance
    const { availableBalance } = await this.getRiderEarnings(riderId);

    if (amount <= 0) throw new Error("Invalid amount");
    if (amount > availableBalance) throw new Error("Insufficient funds");

    // 2. Create Payout Request
    // This creates a PENDING transaction. An admin or cron job would process the actual bank transfer.
    const payout = await prisma.transaction.create({
      data: {
        userId: riderId,
        amount: amount,
        type: TransactionType.DEBIT,
        category: TransactionCategory.WITHDRAWAL,
        status: TransactionStatus.PENDING,
        description: "Payout Request",
        reference: `PAYOUT-${Date.now()}-${riderId.slice(0,4)}`
      }
    });

    return payout;
  }
}
import {
  PrismaClient,
  OrderStatus,
  TransactionType,
  TransactionCategory,
  TransactionStatus,
} from "@prisma/client";

import { OrderStateMachine } from "../utils/order-state-machine";
import { PaymentService } from "../payment/payment.service";
import { sendPushToRiders } from "../utils/push-notification";
import { calculateRiderShare, calculateVendorShare } from "../config/pricing";
import {
  sendAdminPayoutAlert,
  sendOrderStatusEmail,
  sendPayoutRequestEmail,
} from "../utils/email/email.service";
import { payoutSchema } from "../restuarant/restaurant.validator";

const prisma = new PrismaClient();

export class RiderService {
  static async notifyRidersOfNewOrder(orderId: string) {
    await sendPushToRiders(
      "New Delivery Alert! 🚨",
      "A new order is ready for pickup near you.",
      { orderId },
    );
  }

  //1. Fetch available orders (ONLY if rider is free)
static async getAvailableOrders(riderId: string) {
    const rider = await prisma.user.findUnique({
      where: { id: riderId },
      select: { isOnline: true },
    });

    if (!rider || !rider.isOnline) {
      return []; 
    }

    const activeOrder = await prisma.order.findFirst({
      where: {
        riderId: riderId,
        status: {
          in: [OrderStatus.RIDER_ACCEPTED, OrderStatus.OUT_FOR_DELIVERY],
        },
      },
    });

    if (activeOrder) {
      return []; 
    }

    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.READY_FOR_PICKUP,
        riderId: null, 
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
          },
        },
        customer: {
          select: {
            name: true,
            address: true,
          },
        },
        deliveryAddress: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        items: {
          select: {
            quantity: true,
            menuItemName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 🟢 Map to only show the 90% share
    return orders.map(order => ({
      ...order,
      deliveryFee: calculateRiderShare(order.deliveryFee)
    }));
  }


 static async getActiveOrder(riderId: string) {
    const order = await prisma.order.findFirst({
      where: {
        riderId: riderId,
        status: {
          in: [OrderStatus.RIDER_ACCEPTED, OrderStatus.OUT_FOR_DELIVERY],
        },
      },
      include: {
        restaurant: {
          select: {
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            imageUrl: true,
            phone: true,
          },
        },
        customer: {
          select: {
            name: true,
            address: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
        items: true,
      },
    });

    if (!order) return null;

    // 🟢 Return the order with the calculated 90% share
    return {
      ...order,
      deliveryFee: calculateRiderShare(order.deliveryFee)
    };
  }

  // 2. Accept an Order
  //Locks the order to the specific rider and changes status to RIDER_ACCEPTED.
  static async acceptOrder(riderId: string, orderId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Rider Details
      const rider = await tx.user.findUnique({ where: { id: riderId } });
      if (!rider) throw new Error("Rider profile not found");

      // 1. DFA Enforcement (Fetch order first to validate)
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found");
      OrderStateMachine.validateTransition(
        order.status,
        OrderStatus.RIDER_ACCEPTED,
      );

      // Ensure Rider is not busy with another active order
      const existingActiveOrder = await tx.order.findFirst({
        where: {
          riderId: riderId,
          status: {
            in: [OrderStatus.RIDER_ACCEPTED, OrderStatus.OUT_FOR_DELIVERY],
          },
        },
      });
      if (existingActiveOrder) {
        throw new Error("You have an active order. Please complete it first!");
      }

      // Use fallback if name/phone missing
      const riderName = rider.name || "ChowEazy Rider";
      const riderPhone = rider.phone || "";

      // (The Race Condition Fix): Atomic Update
      // instead of "finding" then "updating", we try to update ONLY IF riderId is null.
      let updatedOrder;
      try {
        updatedOrder = await tx.order.update({
          where: {
            id: orderId,
            riderId: null, // <--- CRITICAL: This fails if someone else just took it
            status: OrderStatus.READY_FOR_PICKUP,
          },
          data: {
            status: OrderStatus.RIDER_ACCEPTED,
            riderId: riderId,
            riderName: riderName,
            riderPhone: riderPhone,
          },
          include: { restaurant: true, customer: true },
        });
      } catch (error) {
        // If Prisma throws an error here, it means the 'where' clause failed
        throw new Error(
          "Too late! This order has just been accepted by another rider.",
        );
      }

      // 4. Mark Rider Busy
      await tx.user.update({
        where: { id: riderId },
        data: { isOnline: false },
      });
      if (updatedOrder.customer?.email) {
        sendOrderStatusEmail(
          updatedOrder.customer.email,
          updatedOrder.customer.name,
          updatedOrder.reference,
          OrderStatus.RIDER_ACCEPTED,
        ).catch((e) => console.error("Failed to send rider accepted email", e));
      }

      return updatedOrder;
    });
  }

  //NEW METHOD: Handle Pickup & Delivery

  static async comfirmPickup(riderId: string, orderId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Order and Verify ownership
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) throw new Error("Order not found");
      if (order.riderId !== riderId)
        throw new Error("Unauthorized: This isn't your order to pick up");

      // 2. Validate State (Ensure it's actually ready for pickup)
      OrderStateMachine.validateTransition(
        order.status,
        OrderStatus.OUT_FOR_DELIVERY,
      );

      // 3. Update Order Status ONLY
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.OUT_FOR_DELIVERY },
        include: { restaurant: true, customer: true },
      });

      // 4. Notifications (Purely informational)
      if (updatedOrder.customer?.email) {
        sendOrderStatusEmail(
          updatedOrder.customer.email,
          updatedOrder.customer.name,
          updatedOrder.reference,
          OrderStatus.OUT_FOR_DELIVERY,
        ).catch((e) =>
          console.error("Failed to send out for delivery email", e),
        );
      }

      return updatedOrder;
    });
  }

  static async confirmDelivery(riderId: string, orderId: string, code: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) throw new Error("Order not found");
      if (order.riderId !== riderId)
        throw new Error("Unauthorized access to this order");
      OrderStateMachine.validateTransition(order.status, OrderStatus.DELIVERED);

      if (!order.deliveryCode)
        throw new Error(
          "System Error: No delivery code generated for this order.",
        );

      if (order.deliveryCode !== code) {
        throw new Error(
          "Invalid Delivery Code. Please ask the customer for the correct 4-digit code.",
        );
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
        include: { restaurant: true, customer: true },
      });

      // 🟢 Calculate 90% of the delivery fee for the rider
      const riderEarnings = calculateRiderShare(order.deliveryFee);

      await tx.transaction.create({
        data: {
          userId: riderId,
          amount: riderEarnings, // 🟢 Rider receives the 90% cut
          type: TransactionType.CREDIT,
          category: TransactionCategory.DELIVERY_FEE,
          status: TransactionStatus.SUCCESS,
          description: `Earnings for Order #${order.reference}`,
          orderId: order.id,
          reference: `EARN-${order.reference}-${Date.now()}`,
        },
      });

      await tx.user.update({
        where: { id: riderId },
        data: { isOnline: true },
      });

      if (updatedOrder.customer?.email) {
        sendOrderStatusEmail(
          updatedOrder.customer.email,
          updatedOrder.customer.name,
          updatedOrder.reference,
          OrderStatus.DELIVERED,
        ).catch((e) => console.error("Failed to send delivered email", e));
      }

      return updatedOrder;
    });
  }

  // Get Earnings & Wallet Balance
  //Calculates pending balance and returns transaction history.
  static async getRiderEarnings(riderId: string) {
    const transactions = await prisma.transaction.findMany({
      where: { userId: riderId },
      orderBy: { createdAt: "desc" },
    });

    const totalCredits = transactions
      .filter(
        (t) =>
          t.type === TransactionType.CREDIT &&
          t.status === TransactionStatus.SUCCESS,
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = transactions
      .filter(
        (t) =>
          t.type === TransactionType.DEBIT &&
          (t.status === TransactionStatus.SUCCESS ||
            t.status === TransactionStatus.PENDING),
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const availableBalance = totalCredits - totalDebits;

    const activeOrders = await prisma.order.findMany({
      where: {
        riderId: riderId,
        status: {
          in: [OrderStatus.RIDER_ACCEPTED, OrderStatus.OUT_FOR_DELIVERY],
        },
      },
      select: { deliveryFee: true },
    });

    // 🟢 Update pending balance to reflect only the 90% they will actually earn
    const pendingBalance = activeOrders.reduce(
      (sum, order) => sum + calculateRiderShare(order.deliveryFee),
      0,
    );

    return {
      availableBalance,
      pendingBalance,
      totalEarnings: totalCredits,
      withdrawn: totalDebits,
    };
  }

  // 4. Request Payout
  //Creates a withdrawal request (Debit Transaction).

  static async requestPayout(userId: string, amount: number, bankDetails: any) {
    // 1. Validate input (Assuming you use the same schema as vendor or similar)
    const validData = payoutSchema.parse({ amount, bankDetails });
    // 2. Fetch current earnings to check available balance
    const { availableBalance } = await this.getRiderEarnings(userId);

    if (validData.amount < 1000)
      throw new Error("Minimum withdrawal is ₦1,000");
    if (validData.amount > availableBalance) {
      throw new Error(
        `Insufficient funds. Available: ₦${availableBalance.toLocaleString()}`,
      );
    }

    // 3. Fetch Rider details for notifications
    const rider = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!rider) throw new Error("Rider not found");

    // 4. Atomic Transaction: Create the Ledger Entry
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: validData.amount,
          type: TransactionType.DEBIT,
          category: TransactionCategory.WITHDRAWAL,
          status: TransactionStatus.PENDING, // Funds are "locked"
          description: `Manual Payout Request to ${validData.bankDetails.bankName} (${validData.bankDetails.accountNumber})`,
          reference: `RID-PAY-${Date.now()}`,
        },
      });

      // 5. Trigger Notifications (Non-blocking)
      try {
        // Alert Admin: "
        await sendAdminPayoutAlert(
          rider.name,
          validData.amount,
          validData.bankDetails,
        );

        // Notify Rider: "We've received your request"
        if (rider.email) {
          await sendPayoutRequestEmail({
            email: rider.email,
            ownerName: rider.name,
            restaurantName: "Rider Wallet", // Adjusting template usage
            amount: validData.amount,
            bankName: validData.bankDetails.bankName,
            accountNumber: validData.bankDetails.accountNumber,
          });
        }
      } catch (e: any) {
        console.error(
          "Notification failed, but transaction recorded:",
          e.message,
        );
      }

      return transaction;
    });
  }

 static async getDeliveryHistory(riderId: string) {
    const orders = await prisma.order.findMany({
      where: {
        riderId: riderId,
        status: { in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] }, 
      },
      include: {
        restaurant: { select: { name: true, imageUrl: true, address: true } },
        customer: { select: { name: true } },
        items: { select: { quantity: true, menuItemName: true } }, 
      },
      orderBy: { updatedAt: "desc" },
    });

    // 🟢 Map the history to show only the 90% share earned per order
    return orders.map(order => ({
      ...order,
      deliveryFee: calculateRiderShare(order.deliveryFee)
    }));
  }

  
  static async updateRiderStatus(userId: string, isOnline: boolean) {
    // 1. Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isOnline: isOnline },
      select: {
        id: true,
        name: true,
        isOnline: true,
        email: true,
      }, // Only return what is needed
    });

    return updatedUser;
  }

  //Get rider transaction
  static async getTransactions(userId: string) {
    return await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}

import { PrismaClient, OrderStatus, TransactionType, TransactionCategory, TransactionStatus } from "@prisma/client";

import { OrderStateMachine } from "../utils/order-state-machine";
import { PaymentService } from "../payment/payment.service";
import { sendPushToRiders } from "../utils/push-notification";
import { calculateVendorShare } from "../config/pricing";
import { sendAdminPayoutAlert, sendOrderStatusEmail, sendPayoutRequestEmail } from "../utils/email/email.service";
import { payoutSchema } from "../restuarant/restaurant.validator";

const prisma = new PrismaClient();

export class RiderService {

  static async notifyRidersOfNewOrder(orderId: string) {
    await sendPushToRiders(
      "New Delivery Alert! 🚨",
      "A new order is ready for pickup near you.",
      { orderId }
    );
  }

   //1. Fetch available orders (ONLY if rider is free)
  static async getAvailableOrders(riderId: string) {
    // A. Check if Rider is Busy or Offline
    // We check two things:
    // 1. Are they marked "isOnline: false"? (This happens if they toggled off OR accepted an order)
    // 2. Do they explicitly have an Active Order in the DB? (Safety check)
    
    const rider = await prisma.user.findUnique({
      where: { id: riderId },
      select: { isOnline: true }
    });

    if (!rider || !rider.isOnline) {
       return []; // Return empty list immediately
    }

    // Safety Check: Ensure no active orders exist (Just in case isOnline got desynced)
    const activeOrder = await prisma.order.findFirst({
       where: {
         riderId: riderId,
         status: { in: [OrderStatus.RIDER_ACCEPTED, OrderStatus.OUT_FOR_DELIVERY] }
       }
    });

    if (activeOrder) {
      return []; // You are busy working! No new orders for you.
    }

    // B. If Free, Fetch the Pool
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
            name: true,
            address: true,
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
        restaurant: {
          select:{
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            imageUrl: true,
            phone: true,
          }
        },
        customer: {
          select:{
            name: true,
            address: true,
            phone: true,
            latitude: true,
            longitude:true
          }
        },
        items: true
      }
    });
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
      OrderStateMachine.validateTransition(order.status, OrderStatus.RIDER_ACCEPTED);

      // Ensure Rider is not busy with another active order
      const existingActiveOrder = await tx.order.findFirst({
        where: {
          riderId: riderId,
          status: { in: [OrderStatus.RIDER_ACCEPTED, OrderStatus.OUT_FOR_DELIVERY] }
        }
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
            status: OrderStatus.READY_FOR_PICKUP 
          },
          data: {
            status: OrderStatus.RIDER_ACCEPTED,
            riderId: riderId,
            riderName: riderName,
            riderPhone: riderPhone
          },
          include: { restaurant: true, customer: true }
        });
      } catch (error) {
        // If Prisma throws an error here, it means the 'where' clause failed 
        throw new Error("Too late! This order has just been accepted by another rider.");
      }

      // 4. Mark Rider Busy
      await tx.user.update({ where: { id: riderId }, data: { isOnline: false } });
      if (updatedOrder.customer?.email) {
        sendOrderStatusEmail(
          updatedOrder.customer.email,
          updatedOrder.customer.name,
          updatedOrder.reference,
          OrderStatus.RIDER_ACCEPTED
        ).catch(e => console.error("Failed to send rider accepted email", e));
      }
      

      return updatedOrder;
    });
  }

  //NEW METHOD: Handle Pickup & Delivery

  static async comfirmPickup(riderId: string, orderId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Order and Verify ownership
    const order = await tx.order.findUnique({ 
        where: { id: orderId } 
    });
    
    if (!order) throw new Error("Order not found");
    if (order.riderId !== riderId) throw new Error("Unauthorized: This isn't your order to pick up");

    // 2. Validate State (Ensure it's actually ready for pickup)
    OrderStateMachine.validateTransition(order.status, OrderStatus.OUT_FOR_DELIVERY);

    // 3. Update Order Status ONLY
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.OUT_FOR_DELIVERY },
      include: { restaurant: true, customer: true }
    });

    // 4. Notifications (Purely informational)
    if (updatedOrder.customer?.email) {
      sendOrderStatusEmail(
        updatedOrder.customer.email,
        updatedOrder.customer.name,
        updatedOrder.reference,
        OrderStatus.OUT_FOR_DELIVERY
      ).catch(e => console.error("Failed to send out for delivery email", e));
    }

    return updatedOrder;
  });
}
  

  static async confirmDelivery(riderId: string, orderId: string, code: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      
      if (!order) throw new Error("Order not found");
      if (order.riderId !== riderId) throw new Error("Unauthorized access to this order");
      OrderStateMachine.validateTransition(order.status, OrderStatus.DELIVERED);
      
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

      // 5. Notify Customer
      if (updatedOrder.customer?.email) {
        sendOrderStatusEmail(
          updatedOrder.customer.email,
          updatedOrder.customer.name,
          updatedOrder.reference,
          OrderStatus.DELIVERED
        ).catch(e => console.error("Failed to send delivered email", e));
      }
      
      
      return updatedOrder;
    });
  }

  

  
   // Get Earnings & Wallet Balance
    //Calculates pending balance and returns transaction history.
  static async getRiderEarnings(riderId: string) {
    // A. Fetch Real Transactions (Available Balance)
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

    // B. Fetch Active Orders (Pending Balance)
    // We calculate pending money by looking at orders currently in progress
    const activeOrders = await prisma.order.findMany({
      where: {
        riderId: riderId,
        status: {
          in: [OrderStatus.RIDER_ACCEPTED, OrderStatus.OUT_FOR_DELIVERY]
        }
      },
      select: { deliveryFee: true }
    });

    const pendingBalance = activeOrders.reduce((sum, order) => sum + order.deliveryFee, 0);

    return {
      availableBalance,
      pendingBalance, // <--- Sent to frontend
      totalEarnings: totalCredits, // Historical total
      withdrawn: totalDebits,
      // transactions: transactions.map(t => ({
      //   id: t.id,
      //   amount: t.amount,
      //   type: t.type,
      //   category: t.category,
      //   status: t.status,
      //   description: t.description,
      //   date: t.createdAt,
      //   reference: t.reference
      // }))
    };
  }

  
  // 4. Request Payout
  //Creates a withdrawal request (Debit Transaction).
   
static async requestPayout(userId: string, amount: number, bankDetails: any) {
  // 1. Validate input (Assuming you use the same schema as vendor or similar)
 const validData = payoutSchema.parse({ amount, bankDetails });
  // 2. Fetch current earnings to check available balance
  const { availableBalance } = await this.getRiderEarnings(userId);

  if (validData.amount < 1000) throw new Error("Minimum withdrawal is ₦1,000");
  if (validData.amount > availableBalance) {
    throw new Error(`Insufficient funds. Available: ₦${availableBalance.toLocaleString()}`);
  }

  // 3. Fetch Rider details for notifications
  const rider = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true }
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
      await sendAdminPayoutAlert(rider.name, validData.amount, validData.bankDetails);
      
      // Notify Rider: "We've received your request"
      if (rider.email) {
        await sendPayoutRequestEmail({
          email: rider.email,
          ownerName: rider.name,
          restaurantName: "Rider Wallet", // Adjusting template usage
          amount: validData.amount,
          bankName: validData.bankDetails.bankName,
          accountNumber: validData.bankDetails.accountNumber
        });
      }
    } catch (e: any) {
      console.error("Notification failed, but transaction recorded:", e.message);
    }

    return transaction;
  });
}

  static async getDeliveryHistory(riderId: string) {
    return prisma.order.findMany({
      where: {
        riderId: riderId,
        status: { in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } // Fetch both
      },
      include: {
        restaurant: { select: { name: true, imageUrl: true, address: true } },
        customer: { select: { name: true } },
        items: { select: { quantity: true, menuItemName: true } } // <--- CRITICAL: Include Items
      },
      orderBy: { updatedAt: 'desc' }
    });
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
        email: true 
      } // Only return what is needed
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
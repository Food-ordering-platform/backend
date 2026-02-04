import { PrismaClient, OrderStatus, TransactionType, TransactionCategory, TransactionStatus } from "@prisma/client";
import { getSocketIO } from "../utils/socket";
import { OrderStateMachine } from "../utils/order-state-machine";
import { PaymentService } from "../payment/payment.service";

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

  /**
   * 2. Accept an Order
   * Locks the order to the specific rider and changes status to RIDER_ACCEPTED.
   */
  static async acceptOrder(riderId: string, orderId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Rider Details (Security Best Practice: Don't trust frontend input)
      const rider = await tx.user.findUnique({ where: { id: riderId } });
      if (!rider) throw new Error("Rider profile not found");
      
      // Use fallback if name/phone missing
      const riderName = rider.name || "ChowEazy Rider"; 
      const riderPhone = rider.phone || "";

      // 2. Fetch Order
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found");
      if (order.status !== OrderStatus.READY_FOR_PICKUP) throw new Error("Order is no longer available");
      if (order.riderId) throw new Error("Order has already been taken");

      // 3. Update Order with Rider Details
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.RIDER_ACCEPTED,
          riderId: riderId,
          riderName: riderName,  // <--- Attached here
          riderPhone: riderPhone // <--- Attached here
        },
        include: { restaurant: true, customer: true }
      });

      // 4. Mark Rider Busy
      await tx.user.update({ where: { id: riderId }, data: { isOnline: false } });

      // 5. Notify Socket
      const io = getSocketIO();
      io.to(`order_${orderId}`).emit("order_update", updatedOrder);
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
static async requestPayout(
    riderId: string, 
    amount: number, 
    bankDetails: { bankCode: string; accountNumber: string } // Rider must provide these
  ) {
    // 1. Check Internal Balance
    const { availableBalance } = await this.getRiderEarnings(riderId);

    if (amount <= 0) throw new Error("Invalid amount");
    if (amount < 100) throw new Error("Minimum withdrawal is 100"); // Paystack min is often NGN 100
    if (amount > availableBalance) throw new Error("Insufficient funds");

    const reference = `PAYOUT-${Date.now()}-${riderId.slice(0, 4)}`;

    return await prisma.$transaction(async (tx) => {
      
      // 2. Verify Bank Account (Resolve Name)
      const accountInfo = await PaymentService.resolveAccount(
        bankDetails.accountNumber, 
        bankDetails.bankCode
      );

      // 3. Create Paystack Recipient
      // Note: In a production app, you might save this 'recipient_code' to the User model 
      // so you don't generate it every time.
      const recipientCode = await PaymentService.createTransferRecipient(
        accountInfo.account_name,
        bankDetails.accountNumber,
        bankDetails.bankCode
      );

      // 4. Create Pending Transaction Record (Lock the funds internally)
      const transaction = await tx.transaction.create({
        data: {
          userId: riderId,
          amount: amount, // Stored as positive number, logic handles it as debit
          type: TransactionType.DEBIT,
          category: TransactionCategory.WITHDRAWAL,
          status: TransactionStatus.PENDING, // Pending until Paystack accepts
          description: `Payout to ${accountInfo.account_name}`,
          reference: reference
        }
      });

      // 5. Trigger Paystack Transfer
      // If this fails, the Prisma Transaction will rollback, so no money is lost internally.
      const transferResult = await PaymentService.initiateTransfer(
        amount,
        recipientCode,
        reference,
        "ChowEazy Rider Payout"
      );

      // 6. Update Transaction Status based on Paystack Response
      // Paystack transfers are usually "queued" (OTP) or "success" (Instant).
      // If queued, we keep it PENDING. If success, we mark SUCCESS.
      let finalStatus: TransactionStatus = TransactionStatus.PENDING;
      
      if (transferResult.status === "success") {
        finalStatus = TransactionStatus.SUCCESS;
      } else if (transferResult.status === "failed") {
          throw new Error("Paystack rejected the transfer");
      }

      const updatedTransaction = await tx.transaction.update({
        where: { id: transaction.id },
        data: { 
            status: finalStatus,
            // You could store the transfer_code in description or a new field if needed
            description: `Payout to ${accountInfo.account_name} (Ref: ${transferResult.transfer_code})`
        }
      });

      return updatedTransaction;
    });
  }
}
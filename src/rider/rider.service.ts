import { PrismaClient, OrderStatus, TransactionType, TransactionCategory, TransactionStatus } from "@prisma/client";

import { OrderStateMachine } from "../utils/order-state-machine";
import { PaymentService } from "../payment/payment.service";
import { sendPushToRiders } from "../utils/push-notification";
import { calculateVendorShare } from "../config/pricing";

const prisma = new PrismaClient();

export class RiderService {

  static async notifyRidersOfNewOrder(orderId: string) {
    await sendPushToRiders(
      "New Delivery Alert! 🚨",
      "A new order is ready for pickup near you.",
      { orderId }
    );
  }

  /**
   * 1. Fetch all orders ready for pickup.
   * Includes necessary details for the rider to make a decision (Distance, Fees, Items).
   */
  /**
   * 1. Fetch available orders (ONLY if rider is free)
   */
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

  /**
   * 2. Accept an Order
   * Locks the order to the specific rider and changes status to RIDER_ACCEPTED.
   */
  static async acceptOrder(riderId: string, orderId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Rider Details
      const rider = await tx.user.findUnique({ where: { id: riderId } });
      if (!rider) throw new Error("Rider profile not found");

      // 🛑 GATEKEEPER 1: Ensure Rider is not busy with another active order
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

      // 🛑 GATEKEEPER 2 (The Race Condition Fix): Atomic Update
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
        // (i.e., riderId was NOT null anymore).
        throw new Error("Too late! This order has just been accepted by another rider.");
      }

      // 3. Create PENDING Transaction (Now safe to do)
      await tx.transaction.create({
        data: {
          userId: riderId,
          amount: updatedOrder.deliveryFee, // Expected earning
          type: TransactionType.CREDIT,
          category: TransactionCategory.ORDER_EARNING,
          status: TransactionStatus.PENDING,
          description: `Pending earning for Order #${updatedOrder.reference}`,
          orderId: updatedOrder.id,
          reference: `EARN-${updatedOrder.reference}-${Date.now()}`
        }
      });

      // 4. Mark Rider Busy
      await tx.user.update({ where: { id: riderId }, data: { isOnline: false } });
      
      // 5. Notify Socket (You likely want this here so the UI updates)
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


      return updatedOrder;
    });
  }

  // ---> NEW METHOD: Handle Pickup & Delivery <---
  // src/rider/rider.service.ts

  static async comfirmPickup(riderId: string, orderId: string, status: OrderStatus) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ 
          where: { id: orderId },
          include: { restaurant: true } 
      });
      
      if (!order) throw new Error("Order not found");
      if (order.riderId !== riderId) throw new Error("Unauthorized");

      // 1. Update Order Status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.OUT_FOR_DELIVERY },
        include: { restaurant: true, customer: true }
      });

      // 2. Calculate Share
      const vendorShare = calculateVendorShare(
          Number(updatedOrder.totalAmount), 
          Number(updatedOrder.deliveryFee)
      );

      // 3. Handle Transaction (Create OR Update)
      const existingTx = await tx.transaction.findFirst({
         where: { orderId: updatedOrder.id, category: TransactionCategory.ORDER_EARNING }
      });

      if (existingTx) {
          // 🚨 THE FIX: If it exists but is stuck in PENDING, release it!
          if (existingTx.status !== TransactionStatus.SUCCESS) {
             await tx.transaction.update({
                 where: { id: existingTx.id },
                 data: { status: TransactionStatus.SUCCESS, amount: vendorShare }
             });
          }
      } else {
          // Create NEW Success Transaction
          await tx.transaction.create({
            data: {
                userId: updatedOrder.restaurant.ownerId, 
                amount: vendorShare,
                type: TransactionType.CREDIT,
                category: TransactionCategory.ORDER_EARNING,
                status: TransactionStatus.SUCCESS, // Available immediately
                description: `Earnings for Order #${updatedOrder.reference}`,
                orderId: updatedOrder.id,
                reference: `EARN-${updatedOrder.reference}-${Date.now()}`
            }
          });
      }

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
      
      
      return updatedOrder;
    });
  }

  

  /**
   * 3. Get Earnings & Wallet Balance
   * Calculates pending balance and returns transaction history.
   */
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
// static async requestPayout(
//     riderId: string, 
//     amount: number, 
//     bankDetails: { bankCode: string; accountNumber: string } // Rider must provide these
//   ) {
//     // 1. Check Internal Balance
//     const { availableBalance } = await this.getRiderEarnings(riderId);

//     if (amount <= 0) throw new Error("Invalid amount");
//     if (amount < 100) throw new Error("Minimum withdrawal is 100"); // Paystack min is often NGN 100
//     if (amount > availableBalance) throw new Error("Insufficient funds");

//     const reference = `PAYOUT-${Date.now()}-${riderId.slice(0, 4)}`;

//     return await prisma.$transaction(async (tx) => {
      
//       // 2. Verify Bank Account (Resolve Name)
//       const accountInfo = await PaymentService.resolveAccount(
//         bankDetails.accountNumber, 
//         bankDetails.bankCode
//       );

//       // 3. Create Paystack Recipient
//       // Note: In a production app, you might save this 'recipient_code' to the User model 
//       // so you don't generate it every time.
//       const recipientCode = await PaymentService.createTransferRecipient(
//         accountInfo.account_name,
//         bankDetails.accountNumber,
//         bankDetails.bankCode
//       );

//       // 4. Create Pending Transaction Record (Lock the funds internally)
//       const transaction = await tx.transaction.create({
//         data: {
//           userId: riderId,
//           amount: amount, // Stored as positive number, logic handles it as debit
//           type: TransactionType.DEBIT,
//           category: TransactionCategory.WITHDRAWAL,
//           status: TransactionStatus.PENDING, // Pending until Paystack accepts
//           description: `Payout to ${accountInfo.account_name}`,
//           reference: reference
//         }
//       });

//       // 5. Trigger Paystack Transfer
//       // If this fails, the Prisma Transaction will rollback, so no money is lost internally.
//       const transferResult = await PaymentService.initiateTransfer(
//         amount,
//         recipientCode,
//         reference,
//         "ChowEazy Rider Payout"
//       );

//       // 6. Update Transaction Status based on Paystack Response
//       // Paystack transfers are usually "queued" (OTP) or "success" (Instant).
//       // If queued, we keep it PENDING. If success, we mark SUCCESS.
//       let finalStatus: TransactionStatus = TransactionStatus.PENDING;
      
//       if (transferResult.status === "success") {
//         finalStatus = TransactionStatus.SUCCESS;
//       } else if (transferResult.status === "failed") {
//           throw new Error("Paystack rejected the transfer");
//       }

//       const updatedTransaction = await tx.transaction.update({
//         where: { id: transaction.id },
//         data: { 
//             status: finalStatus,
//             // You could store the transfer_code in description or a new field if needed
//             description: `Payout to ${accountInfo.account_name} (Ref: ${transferResult.transfer_code})`
//         }
//       });

//       return updatedTransaction;
//     });
//   }

static async requestPayout(
    riderId: string, 
    amount: number, 
    bankDetails: { bankCode: string; accountNumber: string }
  ) {
    // 1. Check Internal Balance
    const { availableBalance } = await this.getRiderEarnings(riderId);

    if (amount <= 0) throw new Error("Invalid amount");
    if (amount < 100) throw new Error("Minimum withdrawal is 100"); 
    if (amount > availableBalance) throw new Error("Insufficient funds");

    const reference = `PAYOUT-${Date.now()}-${riderId.slice(0, 4)}`;

    return await prisma.$transaction(async (tx) => {
      
      // 2. Resolve Bank Account (This usually works on Starter Accounts)
      // If this fails, the account number is wrong, so we SHOULD throw an error here.
      const accountInfo = await PaymentService.resolveAccount(
        bankDetails.accountNumber, 
        bankDetails.bankCode
      );

      // 3. Create the Transaction Record (Lock the funds)
      // We mark it as PENDING initially.
      const transaction = await tx.transaction.create({
        data: {
          userId: riderId,
          amount: amount, 
          type: TransactionType.DEBIT,
          category: TransactionCategory.WITHDRAWAL,
          status: TransactionStatus.PENDING, 
          description: `Payout to ${accountInfo.account_name} (${accountInfo.account_number})`,
          reference: reference
        }
      });

      // 4. Try Automatic Payout (But don't crash if it fails)
      try {
        const recipientCode = await PaymentService.createTransferRecipient(
          accountInfo.account_name,
          bankDetails.accountNumber,
          bankDetails.bankCode
        );

        const transferResult = await PaymentService.initiateTransfer(
          amount,
          recipientCode,
          reference,
          "ChowEazy Payout"
        );

        // If Paystack accepts it properly
        if (transferResult.status === "success" || transferResult.status === "otp") {
             // In a real live app, you might wait for a webhook to confirm success.
             // But for now, we assume success if the API didn't error.
             // Ideally, keep it PENDING until webhook, but for MVP:
             // await tx.transaction.update({ ... status: SUCCESS ... })
        }

      } catch (error: any) {
        // ⚠️ HERE IS THE FIX:
        // We catch the "Starter Business" error here.
        console.warn(`⚠️ Automatic Payout Failed (Falling back to Manual): ${error.message}`);
        
        // We update the description so the Admin knows to pay manually
        await tx.transaction.update({
            where: { id: transaction.id },
            data: { 
                description: `MANUAL PAYOUT REQUIRED: ${accountInfo.account_name} - ${accountInfo.account_number} (${error.message})` 
            }
        });

        // WE DO NOT THROW THE ERROR. 
        // We let the function return the 'transaction' object.
        // This means the Rider App receives a "200 OK" and the UI updates.
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
}
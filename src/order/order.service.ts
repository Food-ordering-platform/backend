import { PrismaClient } from "../../generated/prisma";
import { PaymentService } from "../payment/payment.service";

const prisma = new PrismaClient();

export class OrderService {
  // Create order AND initialize payment
  static async createOrderWithPayment(
    customerId: string,
    restaurantId: string,
    totalAmount: number,
    deliveryAddress: string,
    items: { menuItemId: string; quantity: number; price: number }[],
    customerName: string,
    customerEmail: string
  ) {
    // 1️⃣ Create order in DB
    const order = await prisma.order.create({
      data: {
        customerId,
        restaurantId,
        totalAmount,
        paymentStatus: "PENDING",
        status: "PENDING",
        deliveryAddress,
        items: {
          create: items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
      include: { items: true },
    });

    // 2️⃣ Initialize payment
    const checkoutUrl = await PaymentService.initiatePayment(
      totalAmount,
      customerName,
      customerEmail,
      order.reference
    );

    return { order, checkoutUrl };
  }

  // Get all orders for a customer
  static async getOrdersByCustomer(customerId: string) {
    return prisma.order.findMany({
      where: { customerId },
      select: {
        id: true,
        reference: true,
        totalAmount: true,
        paymentStatus: true,
        status: true,
        restaurant: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            price: true,
            menuItem: { select: { name: true } },
          },
        },
        // remove createdAt/updatedAt if you don’t want them
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getOrderByReference(reference: string) {
  return prisma.order.findUnique({
    where: { reference },
    include: {
      restaurant: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          price: true,
          menuItem: { select: { name: true } },
        },
      },
    },
  });
  }
}

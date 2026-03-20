// 

import { 
  PrismaClient, 
  Role, 
  OrderStatus, 
  PaymentStatus, 
  TransactionType, 
  TransactionCategory, 
  TransactionStatus 
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // 1. ENSURE A CUSTOMER EXISTS
  const customer = await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: {
      name: 'Test Customer',
      email: 'customer@test.com',
      role: Role.CUSTOMER,
      isVerified: true,
      phone: '08000000000',
    }
  });
  console.log("✅ Customer ready.");

  // 2. ENSURE A VENDOR AND RESTAURANT EXIST
  const vendor = await prisma.user.upsert({
    where: { email: 'vendor@test.com' },
    update: {},
    create: {
      name: 'Test Vendor',
      email: 'vendor@test.com',
      role: Role.VENDOR,
      isVerified: true,
      phone: '08011111111',
    }
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { ownerId: vendor.id },
    update: {},
    create: {
      name: 'Warri Chop House',
      address: '123 Effurun Road',
      phone: '08011111111',
      email: 'contact@warrichop.com',
      ownerId: vendor.id,
      isOpen: true,
      slug: 'warri-chop-house'
    }
  });
  console.log("✅ Restaurant ready.");

  // 3. ENSURE LOGISTICS COMPANY EXISTS
  const logistics = await prisma.logisticsCompany.upsert({
    where: { managerEmail: 'manager@swift.com' },
    update: {},
    create: {
      name: 'Swift Logistics',
      managerEmail: 'manager@swift.com',
      inviteCode: 'SWIFT-1234',
      bankName: 'Opay',
      accountNumber: '1234567890',
      showEarningsToRiders: false
    }
  });
  console.log("✅ Logistics Company ready.");

  // 4. ENSURE FLEET RIDER EXISTS (Linked to Swift Logistics)
  const rider = await prisma.user.upsert({
    where: { email: 'mike@swift.com' },
    update: { logisticsCompanyId: logistics.id }, // Always ensure he is linked
    create: {
      name: 'Mike Warri',
      email: 'mike@swift.com',
      role: Role.RIDER,
      isVerified: true,
      phone: '08022222222',
      logisticsCompanyId: logistics.id
    }
  });
  console.log("✅ Fleet Rider (Mike) ready.");

  // 5. FAKE THE DELIVERIES AND EARNINGS
  console.log("🚀 Simulating a week of hard work for Mike...");

  for (let i = 1; i <= 5; i++) {
    const uniqueRef = `TEST-ORD-${Date.now()}-${i}`;
    
    // Create the Order
    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: restaurant.id,
        riderId: rider.id,
        totalAmount: 5000,
        deliveryFee: 1200, 
        deliveryDistance: 4.0, // 🟢 Using your exact schema field name!
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        deliveryAddress: `PTI Road, Dropoff ${i}`,
        deliveryPhoneNumber: '08000000000', // 🟢 Required by your schema
        reference: uniqueRef,
        items: {
          create: [
            {
              quantity: 2,
              price: 2500,
              menuItemName: 'Banga Soup & Starch'
            }
          ]
        }
      }
    });

    // Create the 90% payout transaction for Mike (N1,080)
    await prisma.transaction.create({
      data: {
        userId: rider.id,
        amount: 1080, 
        type: TransactionType.CREDIT,
        category: TransactionCategory.DELIVERY_FEE,
        status: TransactionStatus.SUCCESS,
        description: `Earnings for Order #${order.reference}`,
        orderId: order.id,
        reference: `EARN-${order.reference}`,
      }
    });
  }

  console.log("🎉 Seed complete! 5 Deliveries & Transactions created.");
  console.log("You can now test the Excel Download and Mark Paid buttons in the Admin UI!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
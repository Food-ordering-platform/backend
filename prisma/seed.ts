// 

// import { 
//   PrismaClient, 
//   Role, 
//   OrderStatus, 
//   PaymentStatus, 
//   TransactionType, 
//   TransactionCategory, 
//   TransactionStatus 
// } from '@prisma/client';

// const prisma = new PrismaClient();

// async function main() {
//   console.log("🌱 Starting database seed...");

//   // ==========================================
//   // 0. THE CLEANUP CREW (Deletes old seed data)
//   // ==========================================
//   console.log("🧹 Cleaning up old fake orders and transactions...");
//   // We delete transactions first because they rely on the orders (Foreign Key)
//   await prisma.transaction.deleteMany({
//     where: { reference: { startsWith: 'EARN-TEST-ORD' } }
//   });
//   await prisma.order.deleteMany({
//     where: { reference: { startsWith: 'TEST-ORD' } }
//   });
//   console.log("✅ Cleanup complete.");

//   // ==========================================
//   // 1. ENSURE A CUSTOMER EXISTS
//   // ==========================================
//   const customer = await prisma.user.upsert({
//     where: { email: 'customer@test.com' },
//     update: {},
//     create: {
//       name: 'Test Customer',
//       email: 'customer@test.com',
//       role: Role.CUSTOMER,
//       isVerified: true,
//       phone: '08000000000',
//     }
//   });

//   // ==========================================
//   // 2. ENSURE A VENDOR AND RESTAURANT EXIST
//   // ==========================================
//   const vendor = await prisma.user.upsert({
//     where: { email: 'vendor@test.com' },
//     update: {},
//     create: {
//       name: 'Test Vendor',
//       email: 'vendor@test.com',
//       role: Role.VENDOR,
//       isVerified: true,
//       phone: '08011111111',
//     }
//   });

//   const restaurant = await prisma.restaurant.upsert({
//     where: { ownerId: vendor.id },
//     update: {},
//     create: {
//       name: 'Warri Chop House',
//       address: '123 Effurun Road',
//       phone: '08011111111',
//       email: 'contact@warrichop.com',
//       ownerId: vendor.id,
//       isOpen: true,
//       slug: 'warri-chop-house'
//     }
//   });

//   // ==========================================
//   // 3. ENSURE LOGISTICS COMPANY EXISTS
//   // ==========================================
//   const logistics = await prisma.logisticsCompany.upsert({
//     where: { managerEmail: 'manager@swift.com' },
//     update: {},
//     create: {
//       name: 'Swift Logistics',
//       managerEmail: 'manager@swift.com',
//       inviteCode: 'SWIFT-1234',
//       bankName: 'Opay',
//       accountNumber: '1234567890',
//       showEarningsToRiders: false
//     }
//   });

//   // ==========================================
//   // 4. CREATE 5 FLEET RIDERS
//   // ==========================================
//   const riderNames = ['Mike Warri', 'John Effurun', 'Paul Udu', 'Peter Ekpan', 'James Enerhen'];
//   const fleetRiders: any[] = [];

//   for (let i = 0; i < riderNames.length; i++) {
//     const rider = await prisma.user.upsert({
//       where: { email: `rider${i + 1}@swift.com` },
//       update: { logisticsCompanyId: logistics.id },
//       create: {
//         name: riderNames[i],
//         email: `rider${i + 1}@swift.com`,
//         role: Role.RIDER,
//         isVerified: true,
//         phone: `0802222222${i}`,
//         logisticsCompanyId: logistics.id
//       }
//     });
//     fleetRiders.push(rider);
//   }
//   console.log(`✅ 5 Fleet Riders (including Mike) ready.`);

//   // ==========================================
//   // 5. FAKE 10 DELIVERIES PER RIDER
//   // ==========================================
//   console.log("🚀 Simulating a massive week of deliveries...");

//   for (const rider of fleetRiders) {
//     for (let i = 1; i <= 10; i++) {
//       // Generate a random distance between 2km and 6.5km
//       const distance = Math.floor(Math.random() * 5) + 2 + (Math.random() > 0.5 ? 0.5 : 0);
      
//       // Dynamic Fee Calculation exactly like your app config
//       let deliveryFee = 800;
//       if (distance > 2) {
//         deliveryFee += Math.ceil(distance - 2) * 200;
//       }
//       const riderEarnings = deliveryFee * 0.9; // 90% payout

//       const uniqueRef = `TEST-ORD-${rider.id.substring(0,4)}-${Date.now()}-${i}`;
      
//       // Create the Order
//       const order = await prisma.order.create({
//         data: {
//           customerId: customer.id,
//           restaurantId: restaurant.id,
//           riderId: rider.id,
//           totalAmount: 5000,
//           deliveryFee: deliveryFee, 
//           deliveryDistance: parseFloat(distance.toFixed(1)), 
//           status: OrderStatus.DELIVERED,
//           paymentStatus: PaymentStatus.PAID,
//           deliveryAddress: `Random Dropoff in Warri #${i}`,
//           deliveryPhoneNumber: '08000000000', 
//           reference: uniqueRef,
//           items: {
//             create: [
//               {
//                 quantity: 2,
//                 price: 2500,
//                 menuItemName: 'Banga Soup & Starch'
//               }
//             ]
//           }
//         }
//       });

//       // Create the 90% payout transaction
//       await prisma.transaction.create({
//         data: {
//           userId: rider.id,
//           amount: riderEarnings, 
//           type: TransactionType.CREDIT,
//           category: TransactionCategory.DELIVERY_FEE,
//           status: TransactionStatus.SUCCESS,
//           description: `Earnings for Order #${order.reference}`,
//           orderId: order.id,
//           reference: `EARN-${order.reference}`,
//         }
//       });
//     }
//   }

//   console.log("🎉 Seed complete! 50 Deliveries & Transactions created.");
//   console.log("Go download that massive new Excel sheet!");
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });


import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs'; // or 'bcryptjs' if that is what you use in your project

const prisma = new PrismaClient();

async function main() {
  console.log("🔐 Creating Super Admin account...");

  const plainPassword = '123456789';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@choweazy.com' },
    update: {
      password: hashedPassword, // Updates the password if the account already exists
      role: Role.ADMIN,
      isVerified: true,
      isEmailVerified: true,
    },
    create: {
      name: 'ChowEazy Admin',
      email: 'admin@choweazy.com',
      password: hashedPassword,
      phone: '08099999999',
      role: Role.ADMIN,
      isVerified: true,       // Bypasses Admin approval
      isEmailVerified: true,  // Bypasses OTP
    }
  });

  console.log(`✅ Admin account ready!`);
  console.log(`✉️  Email: ${admin.email}`);
  console.log(`🔑 Password: ${plainPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
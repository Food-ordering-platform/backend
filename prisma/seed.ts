// backend/prisma/seed.ts
import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ---- Users ----
  const password = await bcrypt.hash("password123", 10);

  const user1 = await prisma.user.create({
    data: {
      name: "Alice Vendor",
      email: "alice@vendor.com",
      password,
      phone: "08012345678",
      role: "VENDOR",
      isVerified: true,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: "Bob Vendor",
      email: "bob@vendor.com",
      password,
      phone: "08087654321",
      role: "VENDOR",
      isVerified: true,
    },
  });

  // ---- Restaurants ----
  const restaurant1 = await prisma.restaurant.create({
    data: {
      name: "Mama’s Kitchen",
      email: "mama@example.com",
      address: "123 Main Street",
      phone: "08012345678",
      imageUrl:
        "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758018670/Aj_takeaway_le3f7d.webp",
      deliveryTime: "30-40 mins",
      deliveryFee: 500,
      minimumOrder: 1000,
      isOpen: true,
      ownerId: user1.id,
    },
  });

  const restaurant2 = await prisma.restaurant.create({
    data: {
      name: "Spicy Delight",
      email: "spicy@example.com",
      address: "456 Side Street",
      phone: "08087654321",
      imageUrl:
        "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758018721/mr_biggs_azei8n.jpg",
      deliveryTime: "25-35 mins",
      deliveryFee: 300,
      minimumOrder: 800,
      isOpen: true,
      ownerId: user2.id,
    },
  });

  const restaurant3 = await prisma.restaurant.create({
    data: {
      name: "Sweet Treats",
      email: "sweet@example.com",
      address: "789 Market Road",
      phone: "08055555555",
      imageUrl:
        "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758018752/sizzlas_ua6sew.png",
      deliveryTime: "20-30 mins",
      deliveryFee: 200,
      minimumOrder: 500,
      isOpen: true,
      ownerId: user1.id,
    },
  });

  // ---- Menu Items ----
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Jollof Rice",
        description: "Delicious Nigerian jollof rice",
        price: 2000,
        available: true,
        imageUrl:
          "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757464726/a9320e66-595e-41e8-a140-5d91ca15fa49_s0a6ww.jpg",
        restaurantId: restaurant1.id,
      },
      {
        name: "Pepper soup",
        description: "Delicious Spicy pepper soup",
        price: 1800,
        available: true,
        imageUrl:
          "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757465560/Nigerian_Pepper_Soup_offers_a_perfect_balance_of_ndkflh.jpg",
        restaurantId: restaurant1.id,
      },
      {
        name: "Plantain",
        description: "Fresh platain",
        price: 2500,
        available: true,
        imageUrl:
          "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757465502/bdb70baf-edfb-457f-b0d0-46d689d100ad_mgcp4e.jpg",
        restaurantId: restaurant2.id,
      },
      {
        name: "Spaghetti",
        description: "Cheesy spaghetti",
        price: 3000,
        available: true,
        imageUrl:
          "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757464726/ec2567cc-501a-46dd-aeb3-81a66b63b70b_znvfdk.jpg",
        restaurantId: restaurant2.id,
      },
      {
        name: "Boli",
        description: "Rich Boli with big fish",
        price: 1200,
        available: true,
        imageUrl:
          "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757464726/fc43f6be-6d45-4737-95d1-bfc855155ad6_tifydo.jpg",
        restaurantId: restaurant3.id,
      },
    ],
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

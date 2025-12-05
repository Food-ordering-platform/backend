// backend/prisma/seed.ts
import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ---- Password hash ----
  const password = await bcrypt.hash("password123", 10);

  // ---- Users ----
  const vendor1 = await prisma.user.create({
    data: {
      name: "Alice Vendor",
      email: "alice@vendor.com",
      password,
      phone: "08012345678",
      role: "VENDOR",
      isVerified: true,
    },
  });

  const vendor2 = await prisma.user.create({
    data: {
      name: "Bob Vendor",
      email: "bob@vendor.com",
      password,
      phone: "08087654321",
      role: "VENDOR",
      isVerified: true,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      name: "Charlie Customer",
      email: "charlie@customer.com",
      password,
      phone: "08033334444",
      address: "12 Customer Street",
      role: "CUSTOMER",
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
      prepTime: 30,
      deliveryFee: 500,
      minimumOrder: 1000,
      isOpen: true,
      ownerId: vendor1.id,
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
      prepTime: 30,
      deliveryFee: 300,
      minimumOrder: 800,
      isOpen: true,
      ownerId: vendor2.id,
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
      prepTime: 30,
      deliveryFee: 200,
      minimumOrder: 500,
      isOpen: true,
      ownerId: vendor1.id,
    },
  });

  // ---- Categories per restaurant ----
  await prisma.menuCategory.createMany({
    data: [
      { name: "Food", restaurantId: restaurant1.id },
      { name: "Drinks", restaurantId: restaurant1.id },
      { name: "Snacks", restaurantId: restaurant1.id },
      { name: "Ice-Cream", restaurantId: restaurant1.id },
    ],
  });

  await prisma.menuCategory.createMany({
    data: [
      { name: "Food", restaurantId: restaurant2.id },
      { name: "Drinks", restaurantId: restaurant2.id },
    ],
  });

  await prisma.menuCategory.createMany({
    data: [
      { name: "Snacks", restaurantId: restaurant3.id },
      { name: "Ice-Cream", restaurantId: restaurant3.id },
    ],
  });

  // Re-fetch categories so we have IDs
  const allCategories = await prisma.menuCategory.findMany();

  // Helper to get category ID by restaurant+name
  function getCategoryId(restaurantId: string, name: string) {
    const cat = allCategories.find(
      (c) => c.restaurantId === restaurantId && c.name === name
    );
    return cat?.id!;
  }

  // ---- Menu Items ----
  await prisma.menuItem.createMany({
    data: [
      // 🍛 Restaurant 1 – all 4 categories
      {
        name: "Jollof Rice",
        description: "Delicious Nigerian jollof rice",
        price: 2000,
        restaurantId: restaurant1.id,
        categoryId: getCategoryId(restaurant1.id, "Food"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757464726/a9320e66-595e-41e8-a140-5d91ca15fa49_s0a6ww.jpg",
      },
      {
        name: "Coke",
        description: "Chilled Coca-Cola",
        price: 500,
        restaurantId: restaurant1.id,
        categoryId: getCategoryId(restaurant1.id, "Drinks"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283610/Pin_on_PRODUCT_VISUALIZATION_pbclks.jpg",
      },
      {
        name: "Pepsi",
        description: "Refreshing Pepsi drink",
        price: 500,
        restaurantId: restaurant1.id,
        categoryId: getCategoryId(restaurant1.id, "Drinks"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283596/PEPSI_-_ZUMO_Studio_razutw.jpg",
      },
      {
        name: "Meat Pie",
        description: "Freshly baked meat pie",
        price: 800,
        restaurantId: restaurant1.id,
        categoryId: getCategoryId(restaurant1.id, "Snacks"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283620/How_To_Make_Classic_Nigerian_Meat_Pie_tatwvz.jpg",
      },
      {
        name: "Vanilla Ice Cream",
        description: "Creamy vanilla ice cream",
        price: 1000,
        restaurantId: restaurant1.id,
        categoryId: getCategoryId(restaurant1.id, "Ice-Cream"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283634/French_Vanilla_Ice_Cream_ejwkin.jpg",
      },

      // 🌶️ Restaurant 2 – Food + Drinks
      {
        name: "Pepper Soup",
        description: "Spicy Nigerian pepper soup",
        price: 1800,
        restaurantId: restaurant2.id,
        categoryId: getCategoryId(restaurant2.id, "Food"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757465560/Nigerian_Pepper_Soup.jpg",
      },
      {
        name: "Spaghetti",
        description: "Cheesy spaghetti",
        price: 3000,
        restaurantId: restaurant2.id,
        categoryId: getCategoryId(restaurant2.id, "Food"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757464726/spaghetti.jpg",
      },
      {
        name: "Fanta",
        description: "Cold Fanta",
        price: 500,
        restaurantId: restaurant2.id,
        categoryId: getCategoryId(restaurant2.id, "Drinks"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283640/%D0%A2%D1%80%D0%B8_%D1%8F%D1%80%D0%BA%D0%B8%D1%85_%D0%B2%D0%B8%D0%B7%D1%83%D0%B0%D0%BB%D0%B0_Sprite_Coca-Cola_%D0%B8_Fanta_eruezt.jpg",
      },
      {
        name: "Sprite",
        description: "Chilled Sprite",
        price: 500,
        restaurantId: restaurant2.id,
        categoryId: getCategoryId(restaurant2.id, "Drinks"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283650/Crystal-Cool_Sprite_Refreshment_Captured_in_every_sip_tr1fxn.jpg",
      },

      // 🍨 Restaurant 3 – Snacks + Ice-Cream
      {
        name: "Boli",
        description: "Roasted plantain with fish",
        price: 1200,
        restaurantId: restaurant3.id,
        categoryId: getCategoryId(restaurant3.id, "Snacks"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757464726/boli.jpg",
      },
      {
        name: "Chocolate Ice Cream",
        description: "Rich chocolate flavor",
        price: 1200,
        restaurantId: restaurant3.id,
        categoryId: getCategoryId(restaurant3.id, "Ice-Cream"),
        imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283666/Rich_Homemade_Chocolate_Ice_Cream__Irresistibly_Creamy_and_Delicious_af86je.jpg",
      },
    ],
  });

  console.log("Database seeded successfully!");
  console.log("Customer to test orders:", customer1.email, customer1.id);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

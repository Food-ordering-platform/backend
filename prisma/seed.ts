import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
console.log("Seeding database...");

const password = await bcrypt.hash("password123", 10);

// ---- Users ----
const vendor1 = await prisma.user.upsert({
where: { email: "[alice@vendor.com](mailto:alice@vendor.com)" },
update: {},
create: {
name: "Alice Vendor",
email: "[alice@vendor.com](mailto:alice@vendor.com)",
password,
phone: "08012345678",
role: "VENDOR",
isVerified: true,
},
});

const vendor2 = await prisma.user.upsert({
where: { email: "[bob@vendor.com](mailto:bob@vendor.com)" },
update: {},
create: {
name: "Bob Vendor",
email: "[bob@vendor.com](mailto:bob@vendor.com)",
password,
phone: "08087654321",
role: "VENDOR",
isVerified: true,
},
});

const vendor3 = await prisma.user.upsert({
where: { email: "[dan@vendor.com](mailto:dan@vendor.com)" },
update: {},
create: {
name: "Dan Vendor",
email: "[dan@vendor.com](mailto:dan@vendor.com)",
password,
phone: "08055555555",
role: "VENDOR",
isVerified: true,
},
});

const customer1 = await prisma.user.upsert({
where: { email: "[charlie@customer.com](mailto:charlie@customer.com)" },
update: {},
create: {
name: "Charlie Customer",
email: "[charlie@customer.com](mailto:charlie@customer.com)",
password,
phone: "08033334444",
address: "12 Customer Street",
role: "CUSTOMER",
isVerified: true,
},
});

// ---- Restaurants ----
const restaurant1 = await prisma.restaurant.upsert({
where: { email: "[mama@example.com](mailto:mama@example.com)" },
update: {},
create: {
name: "Mama’s Kitchen",
email: "[mama@example.com](mailto:mama@example.com)",
address: "123 Main Street",
phone: "08012345678",
imageUrl: "[https://res.cloudinary.com/dnq5zkskt/image/upload/v1758018670/Aj_takeaway_le3f7d.webp](https://res.cloudinary.com/dnq5zkskt/image/upload/v1758018670/Aj_takeaway_le3f7d.webp)",
prepTime: 35,
minimumOrder: 1000,
isOpen: true,
ownerId: vendor1.id,
},
});

const restaurant2 = await prisma.restaurant.upsert({
where: { email: "[spicy@example.com](mailto:spicy@example.com)" },
update: {},
create: {
name: "Spicy Delight",
email: "[spicy@example.com](mailto:spicy@example.com)",
address: "456 Side Street",
phone: "08087654321",
imageUrl: "[https://res.cloudinary.com/dnq5zkskt/image/upload/v1758018721/mr_biggs_azei8n.jpg](https://res.cloudinary.com/dnq5zkskt/image/upload/v1758018721/mr_biggs_azei8n.jpg)",
prepTime: 30,
minimumOrder: 800,
isOpen: true,
ownerId: vendor2.id,
},
});

const restaurant3 = await prisma.restaurant.upsert({
where: { email: "[sweet@example.com](mailto:sweet@example.com)" },
update: {},
create: {
name: "Sweet Treats",
email: "[sweet@example.com](mailto:sweet@example.com)",
address: "789 Market Road",
phone: "08055555555",
imageUrl: "[https://res.cloudinary.com/dnq5zkskt/image/upload/v1758018752/sizzlas_ua6sew.png](https://res.cloudinary.com/dnq5zkskt/image/upload/v1758018752/sizzlas_ua6sew.png)",
prepTime: 25,
minimumOrder: 500,
isOpen: true,
ownerId: vendor3.id,
},
});

// ---- Categories ----
async function createCategory(name: string, restaurantId: string) {
const existing = await prisma.menuCategory.findFirst({
where: { name, restaurantId },
});
if (existing) return existing;
return prisma.menuCategory.create({ data: { name, restaurantId } });
}

const r1_Food = await createCategory("Food", restaurant1.id);
const r1_Drinks = await createCategory("Drinks", restaurant1.id);
const r1_Snacks = await createCategory("Snacks", restaurant1.id);
const r1_IceCream = await createCategory("Ice-Cream", restaurant1.id);

const r2_Food = await createCategory("Food", restaurant2.id);
const r2_Drinks = await createCategory("Drinks", restaurant2.id);

const r3_Snacks = await createCategory("Snacks", restaurant3.id);
const r3_IceCream = await createCategory("Ice-Cream", restaurant3.id);

// ---- Menu Items ----
await prisma.menuItem.deleteMany({});

await prisma.menuItem.createMany({
data: [
{
name: "Jollof Rice",
description: "Delicious Nigerian jollof rice",
price: 2000,
restaurantId: restaurant1.id,
categoryId: r1_Food.id,
imageUrl: "[https://res.cloudinary.com/dnq5zkskt/image/upload/v1757464726/a9320e66-595e-41e8-a140-5d91ca15fa49_s0a6ww.jpg",
},
{
name: "Coke",
description: "Chilled Coca-Cola",
price: 500,
restaurantId: restaurant1.id,
categoryId: r1_Drinks.id,
imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283610/Pin_on_PRODUCT_VISUALIZATION_pbclks.jpg",
},
{
name: "Meat Pie",
description: "Freshly baked meat pie",
price: 800,
restaurantId: restaurant1.id,
categoryId: r1_Snacks.id,
imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283620/How_To_Make_Classic_Nigerian_Meat_Pie_tatwvz.jpg"
},
{
name: "Vanilla Ice Cream",
description: "Creamy vanilla ice cream",
price: 1000,
restaurantId: restaurant1.id,
categoryId: r1_IceCream.id,
imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283634/French_Vanilla_Ice_Cream_ejwkin.jpg",
},
{
name: "Pepper Soup",
description: "Spicy Nigerian pepper soup",
price: 1800,
restaurantId: restaurant2.id,
categoryId: r2_Food.id,
imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757465560/Nigerian_Pepper_Soup.jpg",
},
{
name: "Spaghetti",
description: "Cheesy spaghetti",
price: 3000,
restaurantId: restaurant2.id,
categoryId: r2_Food.id,
imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757464726/spaghetti.jpg",
},
{
name: "Fanta",
description: "Cold Fanta",
price: 500,
restaurantId: restaurant2.id,
categoryId: r2_Drinks.id,
imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283640/%D0%A2%D1%80%D0%B8_%D1%8F%D1%80%D0%BA%D0%B8%D1%85_%D0%B2%D0%B8%D0%B7%D1%83%D0%B0%D0%BB%D0%B0_Sprite_Coca-Cola_%D0%B8_Fanta_eruezt.jpg",
},
{
name: "Boli",
description: "Roasted plantain with fish",
price: 1200,
restaurantId: restaurant3.id,
categoryId: r3_Snacks.id,
imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1757464726/boli.jpg",
},
{
name: "Chocolate Ice Cream",
description: "Rich chocolate flavor",
price: 1200,
restaurantId: restaurant3.id,
categoryId: r3_IceCream.id,
imageUrl: "https://res.cloudinary.com/dnq5zkskt/image/upload/v1758283666/Rich_Homemade_Chocolate_Ice_Cream__Irresistibly_Creamy_and_Delicious_af86je.jpg",
},
],
});

console.log("Database seeded successfully!");
console.log("Vendors created: Alice, Bob, Dan");
console.log("Customer to test orders:", customer1.email);
}

main()
.catch((e) => {
console.error(e);
process.exit(1);
})
.finally(async () => {
await prisma.$disconnect();
});

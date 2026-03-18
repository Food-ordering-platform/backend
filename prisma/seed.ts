import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@choweazy.com'; // Change to your preferred email
  const plainPassword = 'choweazy@2026'; // Change to a secure password

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log('🛡️ Master Admin already exists.');
    return;
  }

  // Hash password and create admin
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  await prisma.user.create({
    data: {
      name: 'ChowEazy Super Admin',
      email: adminEmail,
      password: hashedPassword,
      phone: '+2348000000000',
      role: Role.ADMIN, // Strictly set to ADMIN
      isVerified: true,
      isEmailVerified: true,
    },
  });

  console.log('✅ Master Admin created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
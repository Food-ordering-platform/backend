import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import prisma from '../utils/prisma';

// 1. Mock the Prisma Client
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

// 2. Export the mocked version so we can control it in tests
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// 3. Mock External Services (So we don't actually send emails or upload images)
jest.mock('nodemailer'); 
jest.mock('cloudinary');
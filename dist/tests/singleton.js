"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaMock = void 0;
const jest_mock_extended_1 = require("jest-mock-extended");
const prisma_1 = __importDefault(require("../utils/prisma"));
// 1. Mock the Prisma Client
jest.mock('../utils/prisma', () => ({
    __esModule: true,
    default: (0, jest_mock_extended_1.mockDeep)(),
}));
// 2. Export the mocked version so we can control it in tests
exports.prismaMock = prisma_1.default;
// 3. Mock External Services (So we don't actually send emails or upload images)
jest.mock('nodemailer');
jest.mock('cloudinary');
//# sourceMappingURL=singleton.js.map
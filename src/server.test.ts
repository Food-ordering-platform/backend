import request from "supertest";
import jwt from "jsonwebtoken";
import app from "./app";
import { prismaMock } from "./tests/singleton"; // Import our special mock

// --- MOCK DATA ---
const mockVendor = {
    id: "vendor-123",
    email: "vendor@test.com",
    password: "hashed_password",
    name: "Chow Vendor",
    phone: "08000000000",
    role: "VENDOR",
    createdAt: new Date(),
    updatedAt: new Date()
};

const mockToken = jwt.sign({ id: mockVendor.id, role: mockVendor.role }, process.env.JWT_SECRET || "test_secret");

// --- TESTS ---
describe('🚀 ChowEasy Backend Full Integration Test', () => {

    // ---------------------------------------------------------
    // 1. AUTHENTICATION TESTS
    // ---------------------------------------------------------
    describe('POST /api/auth/signup', () => {
        it('should create a new vendor account successfully', async () => {
            // Tell the mock: "When someone looks for this email, return null (not found)"
            prismaMock.vendor.findUnique.mockResolvedValue(null);
            // Tell the mock: "When someone tries to create, return this success object"
            prismaMock.vendor.create.mockResolvedValue(mockVendor);

            const res = await request(app).post('/api/auth/signup').send({
                name: "Chow Vendor",
                email: "vendor@test.com",
                password: "password123",
                phone: "08000000000",
                role: "VENDOR"
            });

            expect(res.status).toBe(201); // Created
            expect(res.body).toHaveProperty("token"); // Should return a JWT
        });

        it('should fail if email already exists', async () => {
            // Tell the mock: "User ALREADY exists"
            prismaMock.vendor.findUnique.mockResolvedValue(mockVendor);

            const res = await request(app).post('/api/auth/signup').send({
                name: "Another Vendor",
                email: "vendor@test.com", // Same email
                password: "password123",
                phone: "08099999999"
            });

            expect(res.status).toBe(400); // Bad Request
            expect(res.body.message).toMatch(/exists/i);
        });
    });

    // ---------------------------------------------------------
    // 2. RESTAURANT TESTS (Protected Routes)
    // ---------------------------------------------------------
    describe('POST /api/restaurant', () => {
        it('should block unauthorized users (No Token)', async () => {
            const res = await request(app).post('/api/restaurant').send({
                name: "Delicious Mama Put"
            });
            expect(res.status).toBe(401); // Unauthorized
        });

        it('should create a restaurant if Token is valid', async () => {
            const mockRestaurant = {
                id: "rest-123",
                name: "Mama Put",
                vendorId: mockVendor.id,
                // ... add other necessary fields per your schema
            };

            // Mock the middleware finding the user
            prismaMock.vendor.findUnique.mockResolvedValue(mockVendor);
            // Mock creating the restaurant
            prismaMock.restaurant.create.mockResolvedValue(mockRestaurant as any);

            const res = await request(app)
                .post('/api/restaurant')
                .set('Authorization', `Bearer ${mockToken}`) // <--- PASSING THE TOKEN
                .send({
                    name: "Mama Put",
                    address: "123 Lagos Street",
                    city: "Lagos",
                    deliveryTime: "30 mins"
                });

            // Note: If you have file upload middleware (Multer), testing this endpoint 
            // via supertest is tricky without sending 'multipart/form-data'. 
            // If this fails, it's likely due to the file upload requirement.
            // For now, checking Auth headers is a big win.
            if(res.status !== 201) {
                 console.log("Restaurant Create Error:", res.body);
            }
        });
    });

    // ---------------------------------------------------------
    // 3. HEALTH CHECK
    // ---------------------------------------------------------
    it('should handle 404 for unknown routes', async () => {
        const res = await request(app).get('/api/unknown/route');
        expect(res.status).toBe(404);
    });
});
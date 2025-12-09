import request from "supertest";
import app from "./app"; // Importing your actual app

describe('Server Check', () => {
    // Test 1: Simple Math (Just to be sure Jest works)
    it('should pass this simple test', () => {
        expect(1 + 1).toBe(2);
    });

    // Test 2: Actual Server Test (Checks if your app starts)
    it('should return 404 for random page', async () => {
        const res = await request(app).get('/random-url-that-does-not-exist');
        expect(res.status).toBe(404); 
    });
});
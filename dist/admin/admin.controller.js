"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const admin_service_1 = require("./admin.service");
class AdminController {
    // --- Auth ---
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res
                    .status(400)
                    .json({ success: false, message: "Email and password are required" });
            }
            const data = await admin_service_1.AdminService.loginAdmin(email, password);
            return res.status(200).json({
                success: true,
                message: "Admin login successful",
                ...data,
            });
        }
        catch (error) {
            return res
                .status(401)
                .json({ success: false, message: error.message || "Login failed" });
        }
    }
    // --- Analytics ---
    static async getAnalytics(req, res) {
        try {
            const analytics = await admin_service_1.AdminService.getDashboardAnalytics();
            return res.status(200).json({ success: true, data: analytics });
        }
        catch (error) {
            console.error("Admin Analytics Error:", error);
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch analytics." });
        }
    }
    // Inside your AdminController class...
    static async getChartAnalytics(req, res) {
        try {
            const chartData = await admin_service_1.AdminService.getChartData();
            return res.status(200).json({ success: true, data: chartData });
        }
        catch (error) {
            console.error("Admin Chart Error:", error);
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch chart analytics." });
        }
    }
    // --- Users ---
    static async getUsers(req, res) {
        try {
            const { role } = req.query;
            const users = await admin_service_1.AdminService.getAllUsers(role);
            return res.status(200).json({ success: true, data: users });
        }
        catch (error) {
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch users." });
        }
    }
    static async approveUser(req, res) {
        try {
            const { id } = req.params;
            const user = await admin_service_1.AdminService.approveUser(id);
            return res
                .status(200)
                .json({
                success: true,
                message: "User approved successfully.",
                data: user,
            });
        }
        catch (error) {
            return res
                .status(500)
                .json({ success: false, message: "Failed to approve user." });
        }
    }
    static async deleteUser(req, res) {
        try {
            const { id } = req.params;
            await admin_service_1.AdminService.deleteUser(id);
            return res
                .status(200)
                .json({ success: true, message: "User deleted successfully." });
        }
        catch (error) {
            return res
                .status(500)
                .json({ success: false, message: "Failed to delete user." });
        }
    }
    // --- Payouts ---
    static async getPayouts(req, res) {
        try {
            const payouts = await admin_service_1.AdminService.getPayoutRequests();
            return res.status(200).json({ success: true, data: payouts });
        }
        catch (error) {
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch payouts." });
        }
    }
    static async markPayoutPaid(req, res) {
        try {
            const { id } = req.params;
            const transaction = await admin_service_1.AdminService.markPayoutAsPaid(id);
            return res
                .status(200)
                .json({
                success: true,
                message: "Payout marked as paid.",
                data: transaction,
            });
        }
        catch (error) {
            return res
                .status(500)
                .json({ success: false, message: "Failed to update payout status." });
        }
    }
    // --- Logistics Companies ---
    static async createLogisticsCompany(req, res) {
        try {
            const company = await admin_service_1.AdminService.createLogisticsCompany(req.body);
            return res
                .status(201)
                .json({
                success: true,
                message: "Company created successfully",
                data: company,
            });
        }
        catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getLogisticsCompanies(req, res) {
        try {
            const companies = await admin_service_1.AdminService.getLogisticsCompanies();
            return res.status(200).json({ success: true, data: companies });
        }
        catch (error) {
            return res
                .status(500)
                .json({ success: false, message: "Failed to fetch companies." });
        }
    }
    // --- Weekly Settlements ---
    static async downloadCompanySettlement(req, res) {
        try {
            const { companyId } = req.params;
            // Default to the last 7 days
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 7);
            const excelBuffer = await admin_service_1.AdminService.generateCompanySettlement(companyId, startDate, endDate);
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename=Settlement_${companyId}_${endDate.toISOString().split("T")[0]}.xlsx`);
            return res.status(200).send(excelBuffer);
        }
        catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
    static async markCompanyPaid(req, res) {
        try {
            const { companyId } = req.params;
            const result = await admin_service_1.AdminService.recordCompanyPayout(companyId); // 🟢 Use new name
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=admin.controller.js.map
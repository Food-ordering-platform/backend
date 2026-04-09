"use strict";
// src/config/pricing.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRiderShare = exports.calculateVendorShare = exports.calculateBPS = exports.PRICING = void 0;
exports.PRICING = {
    PLATFORM_FEE: 500,
    VENDOR_SHARE_BPS: 8500, // 85% (Basis Points)
    RIDER_SHARE_BPS: 9000, // 90% (Basis Points)
    // --- Delivery Fee Configuration ---
    DELIVERY_BASE_DISTANCE_KM: 2,
    DELIVERY_BASE_FEE: 800,
    DELIVERY_PER_KM_RATE: 200,
};
/**
 * Core BPS Calculator
 * Math.floor ensures we don't end up with fractional Naira (kobo)
 */
const calculateBPS = (amount, bps) => {
    return Math.floor((amount * bps) / 10000);
};
exports.calculateBPS = calculateBPS;
/**
 * Vendor gets 85% of the FOOD REVENUE only
 */
const calculateVendorShare = (subtotal) => {
    const vendorShare = (0, exports.calculateBPS)(subtotal, exports.PRICING.VENDOR_SHARE_BPS);
    return Math.max(0, vendorShare);
};
exports.calculateVendorShare = calculateVendorShare;
/**
 * Rider gets 90% of the DELIVERY FEE only
 */
const calculateRiderShare = (deliveryFee) => {
    const riderShare = (0, exports.calculateBPS)(deliveryFee, exports.PRICING.RIDER_SHARE_BPS);
    return Math.max(0, riderShare);
};
exports.calculateRiderShare = calculateRiderShare;
//# sourceMappingURL=pricing.js.map
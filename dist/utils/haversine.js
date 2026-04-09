"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDeliveryFee = exports.calculateDistance = void 0;
const pricing_1 = require("../config/pricing"); // 🟢 Import the central config
const TORTUOSITY_FACTOR = 1.5;
function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const airDistance = R * c;
    return airDistance * TORTUOSITY_FACTOR;
};
exports.calculateDistance = calculateDistance;
const calculateDeliveryFee = (distanceKm) => {
    // 🟢 Read from the single source of truth
    const { DELIVERY_BASE_DISTANCE_KM, DELIVERY_BASE_FEE, DELIVERY_PER_KM_RATE } = pricing_1.PRICING;
    if (distanceKm <= DELIVERY_BASE_DISTANCE_KM) {
        return DELIVERY_BASE_FEE;
    }
    const extraKm = distanceKm - DELIVERY_BASE_DISTANCE_KM;
    const extraFee = extraKm * DELIVERY_PER_KM_RATE;
    // Return total fee rounded up to the nearest whole Naira
    return Math.ceil(DELIVERY_BASE_FEE + extraFee);
};
exports.calculateDeliveryFee = calculateDeliveryFee;
//# sourceMappingURL=haversine.js.map
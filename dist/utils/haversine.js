"use strict";
//Haversine formular for calculating distance between 2 points on the earth
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDeliveryFee = exports.calculateDistance = void 0;
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
    const BASE_DISTANCE = 2; // First 2km
    const BASE_FEE = 500;
    const PER_KM_RATE = 100;
    if (distanceKm <= BASE_DISTANCE) {
        return BASE_FEE;
    }
    const extraKm = distanceKm - BASE_DISTANCE;
    const extraFee = extraKm * PER_KM_RATE;
    // Return total fee rounded to nearest whole number
    return Math.ceil(BASE_FEE + extraFee);
};
exports.calculateDeliveryFee = calculateDeliveryFee;
//# sourceMappingURL=haversine.js.map
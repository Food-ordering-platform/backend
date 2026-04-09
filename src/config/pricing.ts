// src/config/pricing.ts

export const PRICING = {
  PLATFORM_FEE: 500,
  VENDOR_SHARE_BPS: 8500, // 85% (Basis Points)
  RIDER_SHARE_BPS: 9000,  // 90% (Basis Points)

  // --- Delivery Fee Configuration ---
  DELIVERY_BASE_DISTANCE_KM: 2,
  DELIVERY_BASE_FEE: 800,
  DELIVERY_PER_KM_RATE: 200,
};

/**
 * Core BPS Calculator
 * Math.floor ensures we don't end up with fractional Naira (kobo)
 */
export const calculateBPS = (amount: number, bps: number): number => {
  return Math.floor((amount * bps) / 10000);
};

/*
 * Vendor gets 85% of the FOOD REVENUE only
 */
export const calculateVendorShare = (subtotal: number): number => {
  const vendorShare = calculateBPS(subtotal, PRICING.VENDOR_SHARE_BPS);
  return Math.max(0, vendorShare);
};

/**
 * Rider gets 90% of the DELIVERY FEE only
 */
export const calculateRiderShare = (deliveryFee: number): number => {
  const riderShare = calculateBPS(deliveryFee, PRICING.RIDER_SHARE_BPS);
  return Math.max(0, riderShare);
};
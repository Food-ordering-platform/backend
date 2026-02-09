

export const PRICING = {
  PLATFORM_FEE: 350,
  VENDOR_SHARE_PERCENTAGE: 0.85, // 85%
};

// 🟢 SHARED LOGIC
export const calculateVendorShare = (totalAmount: number, deliveryFee: number): number => {
  const foodRevenue = totalAmount - (deliveryFee + PRICING.PLATFORM_FEE);
  const vendorShare = foodRevenue * PRICING.VENDOR_SHARE_PERCENTAGE;
  return Math.max(0, vendorShare);
};
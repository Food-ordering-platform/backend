import { PRICING } from "../config/pricing"; // 🟢 Import the central config

const TORTUOSITY_FACTOR = 1.5;

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const airDistance =  R * c;
  
  return airDistance * TORTUOSITY_FACTOR;
};

export const calculateDeliveryFee = (distanceKm: number): number => {
  // 🟢 Read from the single source of truth
  const { DELIVERY_BASE_DISTANCE_KM, DELIVERY_BASE_FEE, DELIVERY_PER_KM_RATE } = PRICING;

  if (distanceKm <= DELIVERY_BASE_DISTANCE_KM) {
    return DELIVERY_BASE_FEE;
  }

  const extraKm = distanceKm - DELIVERY_BASE_DISTANCE_KM;
  const extraFee = extraKm * DELIVERY_PER_KM_RATE;
  
  // Return total fee rounded up to the nearest whole Naira
  return Math.ceil(DELIVERY_BASE_FEE + extraFee);
}
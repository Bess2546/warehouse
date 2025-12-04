// src/common/location-helper.ts

// เช็คว่า lat/lng ใช้ได้ไหม
export function isValidLocation(
  lat?: number | null,
  lng?: number | null,
): boolean {
  if (lat == null || lng == null) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

// helper เอาค่า Lat/Lng/HasValidLocation ออกมาจาก payload
export function extractLocation(payload: any): {
  lat: number | null;
  lng: number | null;
  hasValidLocation: boolean;
} {
  const lat = payload.Lat ?? payload.Latitude ?? null;
  const lng = payload.Lng ?? payload.Longitude ?? null;
  const hasValidLocation = isValidLocation(lat, lng);
  return { lat, lng, hasValidLocation };
}
// src/common/source-helper.ts
export function detectSourceType(sourceId: string): 'M5' | 'Mobile' | 'Tracker' {
  if (!sourceId) return 'Tracker';

  // IMEI = ตัวเลขล้วน 14–16 หลัก → นับเป็น M5
  if (/^[0-9]{14,16}$/.test(sourceId)) {
    return 'M5';
  }

  // ถ้า pattern คล้าย deviceId มือถือ → Mobile
  if (/^(MOBILE-|ANDROID-|IOS-)/i.test(sourceId)) {
    return 'Mobile';
  }

  // ที่เหลือนับเป็น Tracker/M5Id (เช่น GW_A01, M5_A01)
  return 'Tracker';
}

// แปลง MAC -> TagUid แบบไม่มี :
export function macToTagUid(mac: string): string {
  return mac.replace(/:/g, '').toUpperCase(); // "7c:d9:f4:02:e8:0d" -> "7CD9F402E80D"
}

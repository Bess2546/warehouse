export function detectSourceType(
  sourceId: string,
  chipId?: string
): 'M5' | 'Mobile' | 'Tracker' {
  const id = (sourceId || '').trim();

  // A) ถ้ามี chipId ของ ESP32 = 12 hex → นี่คือ M5 แน่นอน
  if (chipId && /^[0-9A-F]{12}$/i.test(chipId)) {
    return 'M5';
  }

  // B) Prefix ของ Gateway
  if (/^(GW_|M5_|GATEWAY)/i.test(id)) {
    return 'M5';
  }

  // C) IMEI = Tracker
  if (/^[0-9]{14,16}$/.test(id)) {
    return 'Tracker';
  }

  // D) Mobile device
  if (/^(MOBILE[-_]|ANDROID[-_]|IOS[-_]|PHONE[-_])/i.test(id)) {
    return 'Mobile';
  }

  return 'Mobile';
}

export function macToTagUid(mac: string): string {
  if (!mac) return '';
  return mac.trim().toUpperCase().replace(/:/g, '');
}
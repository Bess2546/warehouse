export interface EyeDecoded {
  raw: string;
  mac?: string;
  rssi?: number;

  temperatureC?: number;
  humidityPercent?: number;

  movementCount?: number;
  moving?: boolean;

  pitchDeg?: number;
  rollDeg?: number;

  batteryMv?: number;
  lowBattery?: boolean;

  magnetPresent?: boolean;
  magnetDetected?: boolean;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toInt16(value: number): number {
  return value & 0x8000 ? value - 0x10000 : value;
}

function toInt8(value: number): number {
  return value & 0x80 ? value - 0x100 : value;
}

export function decodeEyeRaw(
  rawHex: string,
  meta?: { mac?: string; rssi?: number }
): EyeDecoded | null {
  const bytes = hexToBytes(rawHex);

  if (bytes.length < 4) return null;

  // Manufacturer ID: little-endian → bytes[0], bytes[1]
  const companyId = (bytes[1] << 8) | bytes[0];
  if (companyId !== 0x089a) return null; // ไม่ใช่ Teltonika EYE

  const flags = bytes[3];
  let offset = 4;

  const result: EyeDecoded = {
    raw: rawHex,
    mac: meta?.mac,
    rssi: meta?.rssi,
    magnetPresent: !!(flags & (1 << 2)),
    magnetDetected: !!(flags & (1 << 3)),
    lowBattery: !!(flags & (1 << 6)),
  };

  // TEMP (2 bytes)
  if (flags & (1 << 0)) {
    const rawTemp = (bytes[offset] << 8) | bytes[offset + 1];
    result.temperatureC = toInt16(rawTemp) / 100.0;
    offset += 2;
  }

  // HUMIDITY (1 byte)
  if (flags & (1 << 1)) {
    result.humidityPercent = bytes[offset];
    offset += 1;
  }

  // MOVEMENT COUNTER (2 bytes)
  if (flags & (1 << 4)) {
    const mvRaw = (bytes[offset] << 8) | bytes[offset + 1];
    result.moving = !!(mvRaw & 0x8000);
    result.movementCount = mvRaw & 0x7fff;
    offset += 2;
  }

  // ANGLE (3 bytes)
  if (flags & (1 << 5)) {
    const pitch = bytes[offset];
    const roll = (bytes[offset + 1] << 8) | bytes[offset + 2];
    result.pitchDeg = toInt8(pitch);
    result.rollDeg = toInt16(roll);
    offset += 3;
  }

  // BATTERY (1 byte)
  if (flags & (1 << 7)) {
    result.batteryMv = 2000 + bytes[offset] * 10;
    offset += 1;
  }

  return result;
}
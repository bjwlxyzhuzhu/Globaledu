// 国家时区（UTC 偏移）：常用国家用准确值，其余按经度近似（offset ≈ round(lng/15)）。
const TZ: Record<string, number> = {
  CN: 8, TW: 8, HK: 8, MO: 8, ID: 7, TH: 7, PK: 5, KZ: 5, RU: 3, VN: 7, LA: 7, MY: 8, MN: 8,
  US: -5, GB: 0, FR: 1, DE: 1, JP: 9, KR: 9, IN: 5.5, AU: 10, BR: -3, EG: 2, SA: 3, AE: 4,
  TR: 3, IT: 1, ES: 1, PT: 0, CA: -5, MX: -6, NG: 1, ZA: 2, SG: 8, PH: 8, IR: 3.5, IQ: 3,
  NP: 5.75, BD: 6, MM: 6.5, KH: 7, KP: 9, NL: 1, BE: 1, CH: 1, AT: 1, SE: 1, NO: 1, DK: 1,
  PL: 1, GR: 2, FI: 2, UA: 2, RO: 2, NZ: 12, AR: -3, CL: -3, CO: -5, PE: -5, KE: 3, ET: 3,
  MA: 1, DZ: 1, IL: 2, JO: 2, LB: 2, QA: 3, KW: 3, UZ: 5, AF: 4.5, LK: 5.5, IE: 0,
};

// 几何体的平均经度（用于近似时区 / 相机飞行）
export function centroidLng(geom: unknown): number {
  let sum = 0;
  let n = 0;
  const walk = (c: unknown): void => {
    if (Array.isArray(c)) {
      if (typeof c[0] === 'number') {
        sum += c[0] as number;
        n++;
      } else {
        for (const x of c) walk(x);
      }
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = geom as any;
  if (g?.coordinates) walk(g.coordinates);
  return n ? sum / n : 0;
}

// 几何体的平均纬度
export function centroidLat(geom: unknown): number {
  let sum = 0;
  let n = 0;
  const walk = (c: unknown): void => {
    if (Array.isArray(c)) {
      if (typeof c[0] === 'number') {
        sum += c[1] as number;
        n++;
      } else {
        for (const x of c) walk(x);
      }
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = geom as any;
  if (g?.coordinates) walk(g.coordinates);
  return n ? sum / n : 0;
}

export function tzLabel(code: string, lngFallback?: number): string {
  let off = TZ[code];
  if (off === undefined) {
    if (lngFallback === undefined) return '';
    off = Math.round(lngFallback / 15);
  }
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const h = Math.trunc(abs);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

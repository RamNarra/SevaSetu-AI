/**
 * SevaSetu AI — Geohash (Niemeyer base32) encoder, decoder, neighbor walker.
 *
 * Standard geohash compatible with every other geohash library. Supports
 * neighbor cell queries for Firestore-friendly geo prefilters.
 *
 * Precision guide:
 *   4 chars ≈ ±20 km    (district)
 *   5 chars ≈ ±2.4 km   (neighbourhood)
 *   6 chars ≈ ±0.6 km   (city block)  ← default
 *   7 chars ≈ ±76 m     (street)
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return '';
  const safe = Math.max(1, Math.min(12, Math.floor(precision)));
  let latRange: [number, number] = [-90, 90];
  let lngRange: [number, number] = [-180, 180];
  let bit = 0;
  let ch = 0;
  let geohash = '';
  let even = true;

  while (geohash.length < safe) {
    if (even) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) { ch = (ch << 1) | 1; lngRange = [mid, lngRange[1]]; }
      else { ch = ch << 1; lngRange = [lngRange[0], mid]; }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latRange = [mid, latRange[1]]; }
      else { ch = ch << 1; latRange = [latRange[0], mid]; }
    }
    even = !even;
    if (++bit === 5) {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return geohash;
}

export function decodeGeohash(hash: string): { lat: number; lng: number } {
  if (!hash) return { lat: 0, lng: 0 };
  let latRange: [number, number] = [-90, 90];
  let lngRange: [number, number] = [-180, 180];
  let even = true;
  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) continue;
    for (let mask = 16; mask >= 1; mask >>= 1) {
      const bit = (idx & mask) !== 0;
      if (even) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        lngRange = bit ? [mid, lngRange[1]] : [lngRange[0], mid];
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        latRange = bit ? [mid, latRange[1]] : [latRange[0], mid];
      }
      even = !even;
    }
  }
  return {
    lat: (latRange[0] + latRange[1]) / 2,
    lng: (lngRange[0] + lngRange[1]) / 2,
  };
}

export function adjacentGeohash(hash: string, direction: 'n' | 's' | 'e' | 'w'): string {
  if (!hash) return '';
  const NEIGHBORS: Record<string, [string, string]> = {
    n: ['p0r21436x8zb9dcf5h7kjnmqesgutwvy', 'bc01fg45238967deuvhjyznpkmstqrwx'],
    s: ['14365h7k9dcfesgujnmqp0r2twvyx8zb', '238967debc01fg45kmstqrwxuvhjyznp'],
    e: ['bc01fg45238967deuvhjyznpkmstqrwx', 'p0r21436x8zb9dcf5h7kjnmqesgutwvy'],
    w: ['238967debc01fg45kmstqrwxuvhjyznp', '14365h7k9dcfesgujnmqp0r2twvyx8zb'],
  };
  const BORDERS: Record<string, [string, string]> = {
    n: ['prxz', 'bcfguvyz'],
    s: ['028b', '0145hjnp'],
    e: ['bcfguvyz', 'prxz'],
    w: ['0145hjnp', '028b'],
  };
  const lastCh = hash.charAt(hash.length - 1);
  let parent = hash.substring(0, hash.length - 1);
  const type = hash.length % 2;
  if (BORDERS[direction][type].indexOf(lastCh) !== -1 && parent !== '') {
    parent = adjacentGeohash(parent, direction);
  }
  const idx = NEIGHBORS[direction][type].indexOf(lastCh);
  if (idx < 0) return parent + lastCh;
  return parent + BASE32.charAt(idx);
}

/** Returns the 9 cells (self + 8 neighbors) covering ~1 ring around the hash. */
export function neighborCells(hash: string): string[] {
  if (!hash) return [];
  const n = adjacentGeohash(hash, 'n');
  const s = adjacentGeohash(hash, 's');
  const e = adjacentGeohash(hash, 'e');
  const w = adjacentGeohash(hash, 'w');
  return [
    hash, n, s, e, w,
    adjacentGeohash(n, 'e'),
    adjacentGeohash(n, 'w'),
    adjacentGeohash(s, 'e'),
    adjacentGeohash(s, 'w'),
  ];
}

/** Haversine distance in kilometers between two coordinates. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface GpxStats {
  distanceM: number | null;
  ascentM: number | null;
  /** [minLat, minLon, maxLat, maxLon] */
  bounds: [number, number, number, number] | null;
  points: number;
}

const EARTH_RADIUS_M = 6_371_000;
/** Ignore elevation wiggles smaller than this when summing the climb (GPS noise). */
const ASCENT_THRESHOLD_M = 3;

export function looksLikeGpx(text: string): boolean {
  // Some exporters put a long comment or metadata header first, or prefix the tags (`<gpx:gpx>`).
  return /<(?:[\w.-]+:)?gpx[\s>]/i.test(text.slice(0, 65536));
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Reads track (or route) points from GPX text with plain string matching. No
 * XML parser is involved, so entity-expansion tricks in uploaded files have
 * nothing to hook into.
 */
export function gpxStats(text: string): GpxStats {
  const pointTag = /<(?:([\w.-]+):)?(trkpt|rtept)\b([^>]*?)(\/?)>/gi;
  let distance = 0;
  let ascent = 0;
  let count = 0;
  let prev: { lat: number; lon: number } | null = null;
  let anchorEle: number | null = null;
  let minLat = 90;
  let minLon = 180;
  let maxLat = -90;
  let maxLon = -180;

  for (const match of text.matchAll(pointTag)) {
    const attrs = match[3];
    const lat = Number(/\blat\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]);
    const lon = Number(/\blon\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;

    count += 1;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    if (prev) distance += haversine(prev.lat, prev.lon, lat, lon);
    prev = { lat, lon };

    if (match[4] !== '/') {
      const start = (match.index ?? 0) + match[0].length;
      const end = text.indexOf(
        `</${match[1] ? `${match[1]}:` : ''}${match[2]}`,
        start,
      );
      const inner = text.slice(start, end === -1 ? start : end);
      const ele = Number(
        /<(?:[\w.-]+:)?ele>\s*([^<\s]+)\s*<\/(?:[\w.-]+:)?ele>/i.exec(
          inner,
        )?.[1],
      );
      if (Number.isFinite(ele)) {
        if (anchorEle === null) anchorEle = ele;
        else if (ele - anchorEle >= ASCENT_THRESHOLD_M) {
          ascent += ele - anchorEle;
          anchorEle = ele;
        } else if (anchorEle - ele >= ASCENT_THRESHOLD_M) {
          anchorEle = ele;
        }
      }
    }
  }

  if (count < 2) {
    return { distanceM: null, ascentM: null, bounds: null, points: count };
  }
  return {
    distanceM: Math.round(distance),
    ascentM: anchorEle === null ? null : Math.round(ascent),
    bounds: [minLat, minLon, maxLat, maxLon],
    points: count,
  };
}

/** One point of a drawable track: latitude, longitude, elevation (or null), metres from the start. */
export type TrackPoint = [
  lat: number,
  lon: number,
  ele: number | null,
  distM: number,
];

const DEFAULT_TRACK_POINTS = 800;

/**
 * A track thin enough to draw: the full GPX can have tens of thousands of
 * points, a map needs a few hundred. Points are thinned with the
 * Ramer-Douglas-Peucker method, so the line keeps its shape, and every kept
 * point carries its distance from the start for the elevation profile.
 */
export function gpxTrack(
  text: string,
  maxPoints = DEFAULT_TRACK_POINTS,
): TrackPoint[] {
  const pointTag = /<(?:([\w.-]+):)?(trkpt|rtept)\b([^>]*?)(\/?)>/gi;
  const lats: number[] = [];
  const lons: number[] = [];
  const eles: (number | null)[] = [];
  const dist: number[] = [];

  for (const match of text.matchAll(pointTag)) {
    const attrs = match[3];
    const lat = Number(/\blat\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]);
    const lon = Number(/\blon\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;

    let ele: number | null = null;
    if (match[4] !== '/') {
      const start = (match.index ?? 0) + match[0].length;
      const end = text.indexOf(
        `</${match[1] ? `${match[1]}:` : ''}${match[2]}`,
        start,
      );
      const inner = text.slice(start, end === -1 ? start : end);
      const value = Number(
        /<(?:[\w.-]+:)?ele>\s*([^<\s]+)\s*<\/(?:[\w.-]+:)?ele>/i.exec(
          inner,
        )?.[1],
      );
      if (Number.isFinite(value)) ele = value;
    }
    const n = lats.length;
    dist.push(
      n === 0 ? 0 : dist[n - 1] + haversine(lats[n - 1], lons[n - 1], lat, lon),
    );
    lats.push(lat);
    lons.push(lon);
    eles.push(ele);
  }

  const n = lats.length;
  if (n === 0) return [];
  const keep = simplifyIndices(lats, lons, Math.max(2, maxPoints));
  return keep.map((i) => [
    Math.round(lats[i] * 1e5) / 1e5,
    Math.round(lons[i] * 1e5) / 1e5,
    eles[i] === null ? null : Math.round((eles[i] as number) * 10) / 10,
    Math.round(dist[i]),
  ]);
}

/** Indices of the points to keep; always includes the first and the last. */
function simplifyIndices(
  lats: number[],
  lons: number[],
  maxPoints: number,
): number[] {
  const n = lats.length;
  if (n <= maxPoints) return Array.from({ length: n }, (_, i) => i);

  // Local flat map in metres around the track: precise enough at track size.
  const lat0 = lats[0] * (Math.PI / 180);
  const xs = lons.map((lon) => lon * 111_320 * Math.cos(lat0));
  const ys = lats.map((lat) => lat * 110_540);

  const extent = Math.hypot(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  let epsilon = Math.max(1, extent / (maxPoints * 4));
  let kept = rdp(xs, ys, epsilon);
  for (let i = 0; i < 12 && kept.length > maxPoints; i++) {
    epsilon *= 1.6;
    kept = rdp(xs, ys, epsilon);
  }
  if (kept.length > maxPoints) {
    // Pathological input: fall back to an even sample.
    const step = (n - 1) / (maxPoints - 1);
    kept = Array.from({ length: maxPoints }, (_, i) => Math.round(i * step));
  }
  return kept;
}

function rdp(xs: number[], ys: number[], epsilon: number): number[] {
  const n = xs.length;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [first, last] = stack.pop() as [number, number];
    let maxDist = 0;
    let index = -1;
    const dx = xs[last] - xs[first];
    const dy = ys[last] - ys[first];
    const len = Math.hypot(dx, dy);
    for (let i = first + 1; i < last; i++) {
      const d =
        len === 0
          ? Math.hypot(xs[i] - xs[first], ys[i] - ys[first])
          : Math.abs(
              dy * xs[i] -
                dx * ys[i] +
                xs[last] * ys[first] -
                ys[last] * xs[first],
            ) / len;
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > epsilon) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

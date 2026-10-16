import { gpxStats, gpxTrack, looksLikeGpx } from './gpx';

const GPX = `<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
<trkpt lat="52.0000" lon="13.0000"><ele>100</ele></trkpt>
<trkpt lat="52.0100" lon="13.0000"><ele>120</ele></trkpt>
<trkpt lat="52.0200" lon="13.0000"><ele>110</ele></trkpt>
</trkseg></trk></gpx>`;

describe('gpxStats', () => {
  it('recognises GPX and measures distance, climb and bounds', () => {
    expect(looksLikeGpx(GPX)).toBe(true);
    const stats = gpxStats(GPX);
    expect(stats.points).toBe(3);
    // 0.02 degrees of latitude is about 2224 m
    expect(stats.distanceM).toBeGreaterThan(2200);
    expect(stats.distanceM).toBeLessThan(2250);
    expect(stats.ascentM).toBe(20);
    expect(stats.bounds).toEqual([52, 13, 52.02, 13]);
  });

  it('rejects non-GPX text and tolerates files without points', () => {
    expect(looksLikeGpx('<html></html>')).toBe(false);
    expect(gpxStats('<gpx></gpx>').distanceM).toBeNull();
  });
});

describe('gpxTrack', () => {
  const gpx = (n: number) =>
    `<gpx><trk><trkseg>${Array.from(
      { length: n },
      (_, i) =>
        `<trkpt lat="${50 + i * 0.0001}" lon="${8 + Math.sin(i / 20) * 0.01}"><ele>${100.123 + i}</ele></trkpt>`,
    ).join('')}</trkseg></trk></gpx>`;

  it('keeps all points of a small track', () => {
    const pts = gpxTrack(gpx(10));
    expect(pts).toHaveLength(10);
    expect(pts[0][3]).toBe(0);
    expect(pts[0][2]).toBe(100.1);
  });

  it('thins a large track and keeps the ends', () => {
    const pts = gpxTrack(gpx(5000), 200);
    expect(pts.length).toBeLessThanOrEqual(200);
    expect(pts.length).toBeGreaterThan(2);
    expect(pts[0][0]).toBeCloseTo(50, 4);
    expect(pts[pts.length - 1][0]).toBeCloseTo(50 + 4999 * 0.0001, 4);
    for (let i = 1; i < pts.length; i++)
      expect(pts[i][3]).toBeGreaterThanOrEqual(pts[i - 1][3]);
  });
});

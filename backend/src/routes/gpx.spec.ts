import { gpxStats, looksLikeGpx } from './gpx';

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

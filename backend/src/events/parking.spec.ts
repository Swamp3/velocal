import { distanceMeters } from './parking';

describe('distanceMeters', () => {
  it('measures the straight line between two points', () => {
    // Frankfurt Römer to the main station, about 1.6 km.
    const meters = distanceMeters(
      { lat: 50.1106, lng: 8.6821 },
      { lat: 50.1071, lng: 8.6638 },
    );
    expect(meters).toBeGreaterThan(1300);
    expect(meters).toBeLessThan(1500);
    expect(distanceMeters({ lat: 50, lng: 8 }, { lat: 50, lng: 8 })).toBe(0);
  });
});

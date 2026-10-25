import type * as LeafletNS from 'leaflet';

let leaflet: Promise<typeof LeafletNS> | undefined;

/**
 * Loads Leaflet once, on first use, with the default marker icon set. Maps call this only after
 * the user asked for a map, so pages without an opened map never load Leaflet or map tiles.
 */
export function loadLeaflet(): Promise<typeof LeafletNS> {
  leaflet ??= import('leaflet').then((mod) => {
    const L = (mod as unknown as { default?: typeof LeafletNS }).default ?? (mod as unknown as typeof LeafletNS);
    L.Marker.prototype.options.icon = L.icon({
      iconUrl: 'assets/marker-icon.png',
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
    return L;
  });
  return leaflet;
}

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

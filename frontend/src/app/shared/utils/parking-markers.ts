import type * as LeafletNS from 'leaflet';
import type { ParkingArea } from '@shared/models';
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from './map-links';

/** A square "P" marker, distinct from the event pin. */
function parkingIcon(L: typeof LeafletNS): LeafletNS.DivIcon {
  return L.divIcon({
    className: '',
    html:
      '<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;' +
      'border-radius:6px;background:#1d4ed8;color:#fff;font:700 14px/1 system-ui,sans-serif;' +
      'border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">P</span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

/** Popup content built from text nodes, so names from users or imports cannot inject markup. */
function popupContent(area: ParkingArea): HTMLElement {
  const box = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = area.name;
  box.append(title);
  const target = `${area.coordinates.lat},${area.coordinates.lng}`;
  for (const [label, href] of [
    ['Google Maps', googleMapsDirectionsUrl(target)],
    ['Apple Maps', appleMapsDirectionsUrl(target)],
  ]) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = label;
    link.style.display = 'block';
    box.append(link);
  }
  return box;
}

/** Adds the parking areas to a map; with `popups`, each marker links to navigation. */
export function addParkingMarkers(
  L: typeof LeafletNS,
  map: LeafletNS.Map,
  areas: ParkingArea[],
  popups = false,
): LeafletNS.Marker[] {
  const icon = parkingIcon(L);
  return areas.map((area) => {
    const marker = L.marker([area.coordinates.lat, area.coordinates.lng], {
      icon,
      title: area.name,
      alt: area.name,
    }).addTo(map);
    if (popups) marker.bindPopup(() => popupContent(area));
    return marker;
  });
}

/** Bounds around the event's place and its parking areas, or null without parking. */
export function boundsWithParking(
  L: typeof LeafletNS,
  venue: { lat: number; lng: number },
  areas: ParkingArea[],
): LeafletNS.LatLngBounds | null {
  if (!areas.length) return null;
  return L.latLngBounds([
    [venue.lat, venue.lng],
    ...areas.map((a) => [a.coordinates.lat, a.coordinates.lng] as [number, number]),
  ]);
}

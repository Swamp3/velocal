/**
 * Links that open the user's maps app with a route to a place given as free text
 * (an address or a name). On a phone they start navigation from the current position;
 * on a computer they open the route planner.
 */
export function googleMapsDirectionsUrl(place: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.trim())}`;
}

export function appleMapsDirectionsUrl(place: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(place.trim())}&dirflg=d`;
}

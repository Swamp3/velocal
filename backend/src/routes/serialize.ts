import { Route } from './entities/route.entity';

export interface SerializedRouteFile {
  id: string;
  label: string;
  sizeBytes: number;
  distanceM: number | null;
  ascentM: number | null;
  bounds: [number, number, number, number] | null;
}

export interface SerializedRoute {
  id: string;
  name: string;
  description: string | null;
  canEdit: boolean;
  totalDistanceM: number | null;
  files: SerializedRouteFile[];
  createdAt: Date;
}

export function serializeRoute(
  route: Route,
  canEdit: boolean,
): SerializedRoute {
  const files = [...(route.files ?? [])]
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .map((file) => ({
      id: file.id,
      label: file.label,
      sizeBytes: file.sizeBytes,
      distanceM: file.distanceM,
      ascentM: file.ascentM,
      bounds: file.bounds,
    }));
  const measured = files.filter((file) => file.distanceM !== null);
  return {
    id: route.id,
    name: route.name,
    description: route.description,
    canEdit,
    totalDistanceM: measured.length
      ? measured.reduce((sum, file) => sum + (file.distanceM ?? 0), 0)
      : null,
    files,
    createdAt: route.createdAt,
  };
}

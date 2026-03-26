export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  center?: { lat: number; lng: number };
}

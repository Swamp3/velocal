import { Injectable, Logger } from '@nestjs/common';

interface GeocodingResult {
  lat: number;
  lng: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, GeocodingResult | null>();
  private lastRequestTime = 0;

  private static readonly NOMINATIM_URL =
    'https://nominatim.openstreetmap.org/search';
  private static readonly MIN_REQUEST_INTERVAL_MS = 1100;

  async geocodeZip(
    zip: string,
    country?: string,
  ): Promise<GeocodingResult | null> {
    const cacheKey = `${zip}:${country ?? ''}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    await this.throttle();

    const params = new URLSearchParams({
      postalcode: zip,
      format: 'json',
      limit: '1',
    });
    if (country) {
      params.set('country', country);
    }

    try {
      const res = await fetch(
        `${GeocodingService.NOMINATIM_URL}?${params.toString()}`,
        {
          headers: { 'User-Agent': 'VeloCal/1.0 (https://velocal.dev)' },
        },
      );

      if (!res.ok) {
        this.logger.warn(`Nominatim returned ${res.status} for zip=${zip}`);
        return null;
      }

      const data = (await res.json()) as { lat: string; lon: string }[];
      if (!data.length) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const result: GeocodingResult = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error('Nominatim geocoding failed', error);
      return null;
    }
  }

  async geocodeLocation(
    locationName: string,
    address?: string,
    country?: string,
  ): Promise<GeocodingResult | null> {
    const { city, postalcode } = this.parseLocation(locationName);
    const cacheKey = `loc:${postalcode ?? ''}:${city}:${address ?? ''}:${country ?? ''}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    await this.throttle();

    const params = new URLSearchParams({
      format: 'json',
      limit: '1',
    });

    params.set('city', city);
    if (postalcode) params.set('postalcode', postalcode);
    if (address) params.set('street', address);
    if (country) params.set('countrycodes', country.toLowerCase());

    try {
      const res = await fetch(
        `${GeocodingService.NOMINATIM_URL}?${params.toString()}`,
        {
          headers: { 'User-Agent': 'VeloCal/1.0 (https://velocal.dev)' },
        },
      );

      if (!res.ok) {
        this.logger.warn(
          `Nominatim returned ${res.status} for city="${city}"`,
        );
        this.cache.set(cacheKey, null);
        return null;
      }

      const data = (await res.json()) as { lat: string; lon: string }[];

      if (!data.length && (postalcode || address)) {
        return this.geocodeFallback(city, country, cacheKey);
      }

      if (!data.length) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const result: GeocodingResult = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(`Nominatim geocoding failed for "${city}"`, error);
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  private async geocodeFallback(
    city: string,
    country: string | undefined,
    cacheKey: string,
  ): Promise<GeocodingResult | null> {
    await this.throttle();

    const params = new URLSearchParams({
      city,
      format: 'json',
      limit: '1',
    });
    if (country) params.set('countrycodes', country.toLowerCase());

    try {
      const res = await fetch(
        `${GeocodingService.NOMINATIM_URL}?${params.toString()}`,
        {
          headers: { 'User-Agent': 'VeloCal/1.0 (https://velocal.dev)' },
        },
      );

      if (!res.ok) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const data = (await res.json()) as { lat: string; lon: string }[];
      if (!data.length) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const result: GeocodingResult = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
      this.cache.set(cacheKey, result);
      return result;
    } catch {
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  private parseLocation(location: string): {
    city: string;
    postalcode?: string;
  } {
    const match = location.match(/^(\d{4,5})\s+(.+)$/);
    if (match) {
      return { postalcode: match[1], city: match[2].trim() };
    }
    return { city: location.trim() };
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < GeocodingService.MIN_REQUEST_INTERVAL_MS) {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          GeocodingService.MIN_REQUEST_INTERVAL_MS - elapsed,
        ),
      );
    }
    this.lastRequestTime = Date.now();
  }
}

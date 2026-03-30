import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ImportSource,
  RawEvent,
} from '../interfaces/import-source.interface';

const BASE_URL = 'https://my.raceresult.com';
const LIST_URL = `${BASE_URL}/RREvents/list`;
const REQUEST_DELAY_MS = 1500;
const DEFAULT_LIMIT = 500;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 3000;

const TYPE_DISCIPLINE_MAP: [number, string][] = [
  [11, 'strasse'],
  [22, 'breitensport'],
  [13, 'bmx'],
  [20, 'cyclo-cross'],
  [2, 'mtb'],
];

interface ListResponse {
  Mode: string;
  Label: string;
  HasMore: boolean;
  Events: unknown[][];
}

@Injectable()
export class RaceResultSource implements ImportSource {
  readonly name = 'race-result';
  private readonly logger = new Logger(RaceResultSource.name);
  private readonly countries: number[];
  private readonly limit: number;

  constructor(private readonly config: ConfigService) {
    const envCountries = this.config.get<string>('RACE_RESULT_COUNTRIES');
    this.countries = envCountries
      ? envCountries.split(',').map(Number)
      : [276, 528];
    this.limit = DEFAULT_LIMIT;
  }

  async fetch(): Promise<RawEvent[]> {
    const events: RawEvent[] = [];

    for (const country of this.countries) {
      for (const [type, disciplineSlug] of TYPE_DISCIPLINE_MAP) {
        await this.delay(REQUEST_DELAY_MS);
        this.logger.log(
          `Fetching type=${type} (${disciplineSlug}) country=${country}`,
        );

        try {
          const results = await this.fetchWithRetry(type, country);
          if (!results) {
            this.logger.debug(
              `Null response for type=${type} country=${country}`,
            );
            continue;
          }

          for (const result of results) {
            if (!result.Events?.length) continue;

            events.push(...this.mapEvents(result.Events, disciplineSlug));

            if (result.HasMore) {
              this.logger.warn(
                `HasMore=true for type=${type} country=${country} — consider increasing limit`,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to fetch type=${type} country=${country} after ${MAX_RETRIES} attempts`,
            error,
          );
        }
      }
    }

    this.logger.log(`Total events fetched: ${events.length}`);
    return events;
  }

  private async fetchWithRetry(
    type: number,
    country: number,
  ): Promise<ListResponse[] | null> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.fetchList(type, country);
      } catch (error) {
        if (attempt === MAX_RETRIES) throw error;
        this.logger.warn(
          `Fetch attempt ${attempt} failed, retrying in ${RETRY_BACKOFF_MS}ms...`,
        );
        await this.delay(RETRY_BACKOFF_MS);
      }
    }
    throw new Error('Unreachable');
  }

  private async fetchList(
    type: number,
    country: number,
  ): Promise<ListResponse[] | null> {
    const url = new URL(LIST_URL);
    url.searchParams.set('type', String(type));
    url.searchParams.set('country', String(country));
    url.searchParams.set('group', '0');
    url.searchParams.set('user', '0');
    url.searchParams.set('geoLocation', 'IP');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('modes', 'topUpcoming');
    url.searchParams.set('limit', String(this.limit));

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'VeloCal/1.0 (https://velocal.cc)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    const body = await res.json();
    if (body === null) return null;

    return body as ListResponse[];
  }

  private mapEvents(tuples: unknown[][], disciplineSlug: string): RawEvent[] {
    return tuples
      .filter((t) => t[0] != null && t[2])
      .map((t) => ({
        externalId: `rr-${t[0]}`,
        sourceName: this.name,
        name: String(t[2]).trim(),
        startDate: new Date(`${t[3]}T00:00:00Z`),
        endDate: t[4] ? new Date(`${t[4]}T00:00:00Z`) : undefined,
        locationName: String(t[5]),
        country: String(t[6]),
        lat: Number(t[7]),
        lng: Number(t[8]),
        disciplineSlug,
        externalUrl: `${BASE_URL}/${t[0]}/info`,
        status: 'published',
      }));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

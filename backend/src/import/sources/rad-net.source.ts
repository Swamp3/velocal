import { Injectable, Logger } from '@nestjs/common';
import { load, type CheerioAPI } from 'cheerio';
import {
  ImportSource,
  RawEvent,
} from '../interfaces/import-source.interface';

const BASE_URL = 'https://www.rad-net.de';
const LISTING_URL = `${BASE_URL}/rad-net-portal/rad-net-ausschreibungen.htm?url=%2Fmodules.php%3Fname%3DAusschreibung%26extsearch%3D1&url_hash=12zwZUQXsPe4JWe946PCaJnZ2I4puRrzgGrTr1DG7Vo`;
const MAX_PAGES = 30;
const REQUEST_DELAY_MS = 1500;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 3000;

const DISCIPLINE_MAP: Record<string, string> = {
  'str.': 'strasse',
  'straße': 'strasse',
  'strasse': 'strasse',
  'bahn': 'bahn',
  'cx': 'cyclo-cross',
  'cyclo-cross': 'cyclo-cross',
  'querfeldein': 'cyclo-cross',
  'mtb': 'mtb',
  'bmx': 'bmx',
  'halle': 'halle',
  'kunstrsp.': 'halle',
  'kunstradsport': 'halle',
  'trial': 'trial',
  'breitensport': 'breitensport',
  'gravel': 'gravel',
};

const STATUS_MAP: Record<string, string> = {
  'ausgeschrieben': 'published',
  'abgesagt': 'cancelled',
  'durchgeführt': 'completed',
  'durchgefuehrt': 'completed',
};

@Injectable()
export class RadNetSource implements ImportSource {
  readonly name = 'rad-net';
  private readonly logger = new Logger(RadNetSource.name);

  async fetch(): Promise<RawEvent[]> {
    const events: RawEvent[] = [];
    let url: string | null = LISTING_URL;
    let page = 0;
    let consecutiveFailures = 0;

    while (url && page < MAX_PAGES) {
      page++;
      this.logger.log(`Fetching page ${page}: ${url}`);

      try {
        const html = await this.fetchWithRetry(url);
        const $ = load(html);
        const pageEvents = this.parsePage($);
        events.push(...pageEvents);
        consecutiveFailures = 0;

        this.logger.log(`Page ${page}: found ${pageEvents.length} events`);

        if (pageEvents.length === 0) {
          this.logger.warn(`Page ${page} yielded 0 events, stopping`);
          break;
        }

        url = this.getNextPageUrl($);
        if (url) {
          await this.delay(REQUEST_DELAY_MS);
        }
      } catch (error) {
        consecutiveFailures++;
        this.logger.error(
          `Failed to fetch page ${page} (failure ${consecutiveFailures})`,
          error,
        );
        if (consecutiveFailures >= 3) {
          this.logger.error('Too many consecutive failures, stopping');
          break;
        }
        await this.delay(RETRY_BACKOFF_MS);
      }
    }

    this.logger.log(
      `Total events fetched: ${events.length}, enriching with detail pages...`,
    );
    await this.enrichWithDetails(events);

    return events;
  }

  private async fetchWithRetry(url: string): Promise<string> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.fetchPage(url);
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

  private async fetchPage(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'VeloCal/1.0 (https://velocal.cc)',
        Accept: 'text/html',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    return res.text();
  }

  private parsePage($: CheerioAPI): RawEvent[] {
    const events: RawEvent[] = [];

    $('tr[onmouseover*="setPointer"]').each((_i, row) => {
      const cells = $(row).children('td');
      if (cells.length < 7) return;

      const dateText = $(cells[0]).text().trim();
      const titleEl = $(cells[1]).find('a').first();
      const name = titleEl.length
        ? titleEl.text().trim()
        : $(cells[1]).text().trim();
      const detailHref = titleEl.attr('href');
      const locationName = $(cells[2]).text().trim();
      const disciplineText = $(cells[3]).text().trim().toLowerCase();
      const deadlineText = $(cells[5]).text().trim();
      const statusText = $(cells[6]).text().trim();

      if (!name || !dateText) return;

      const { start, end } = this.parseDateRange(dateText);
      if (!start) return;

      const disciplineSlug = this.mapDiscipline(disciplineText);
      const status = this.mapStatus(statusText);
      const externalId = this.extractEventId(detailHref);
      const externalUrl = detailHref
        ? this.resolveUrl(detailHref)
        : undefined;
      const registrationDeadline = deadlineText
        ? this.parseGermanDate(deadlineText)
        : undefined;

      events.push({
        externalId: externalId ?? `rad-net-${name}-${start.toISOString().slice(0, 10)}`,
        sourceName: this.name,
        name,
        startDate: start,
        endDate: end,
        disciplineSlug,
        locationName,
        country: 'DE',
        registrationDeadline: registrationDeadline ?? undefined,
        externalUrl,
        status,
      });
    });

    return events;
  }

  private parseDateRange(text: string): {
    start: Date | null;
    end?: Date;
  } {
    const cleaned = text.replace(/\s+/g, ' ');
    const bisParts = cleaned.split(/\bbis\b/i);

    const start = this.parseGermanDate(bisParts[0]);
    const end =
      bisParts.length > 1
        ? (this.parseGermanDate(bisParts[1]) ?? undefined)
        : undefined;

    return { start, end };
  }

  private parseGermanDate(text: string): Date | null {
    const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!match) return null;

    const [, day, month, year] = match;
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  }

  private mapDiscipline(text: string): string {
    const normalized = text
      .replace(/\u00AD/g, '')
      .replace(/[.\s]/g, '')
      .toLowerCase();

    for (const [key, slug] of Object.entries(DISCIPLINE_MAP)) {
      if (normalized.includes(key.replace(/[.\s]/g, ''))) {
        return slug;
      }
    }

    return 'strasse';
  }

  private mapStatus(text: string): string {
    const normalized = text
      .replace(/\u00AD/g, '')
      .replace(/[\s-]/g, '')
      .toLowerCase();

    for (const [key, status] of Object.entries(STATUS_MAP)) {
      if (normalized.includes(key)) {
        return status;
      }
    }

    return 'published';
  }

  private extractEventId(href: string | undefined): string | null {
    if (!href) return null;

    const decoded = decodeURIComponent(href);
    const match = decoded.match(/ID_Veranstaltung[=](\d+)/i);
    return match ? match[1] : null;
  }

  private resolveUrl(href: string): string {
    if (href.startsWith('http')) return href;
    return `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
  }

  private async enrichWithDetails(events: RawEvent[]): Promise<void> {
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event.externalUrl) continue;

      try {
        await this.delay(REQUEST_DELAY_MS);
        const html = await this.fetchWithRetry(event.externalUrl);
        const $ = load(html);
        const detail = this.parseDetailFields($);

        if (detail.address) {
          event.address = detail.address;
        }
        if (detail.ort) {
          event.locationName = detail.ort;
        }

        this.logger.debug(
          `[${i + 1}/${events.length}] ${event.name}: ort=${detail.ort}, address=${detail.address}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to fetch details for "${event.name}"`,
          error,
        );
      }
    }
  }

  private parseDetailFields($: CheerioAPI): {
    address?: string;
    ort?: string;
  } {
    let start: string | undefined;
    let ziel: string | undefined;
    let ort: string | undefined;

    $('table tr').each((_i, row) => {
      const cells = $(row).children('td');
      if (cells.length < 2) return;

      const label = $(cells[0]).text().trim().replace(/:$/, '');
      const value = $(cells[1]).text().trim();

      if (label === 'Ort') ort = value;
      if (label === 'Start') start = value;
      if (label === 'Ziel') ziel = value;
    });

    return {
      address: start || ziel || undefined,
      ort: ort || undefined,
    };
  }

  private getNextPageUrl($: CheerioAPI): string | null {
    const nextLink = $('a')
      .filter((_i, el) => {
        const text = $(el).text().trim();
        return text === 'Nächste' || text === 'N\u00e4chste';
      })
      .first();

    const href = nextLink.attr('href');
    if (!href) return null;

    return this.resolveUrl(href);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

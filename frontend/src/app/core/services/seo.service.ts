import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_URL } from '@core/tokens/site-url';

export interface SeoMeta {
  /** Page-specific title; will be suffixed with " — VeloCal" unless it already contains the site name. */
  title: string;
  description: string;
  /** Absolute or path-relative image URL. Falls back to the default site OG. */
  image?: string;
  /** Absolute canonical URL. */
  url?: string;
  type?: 'website' | 'article' | 'event';
  publishedAt?: string;
  modifiedAt?: string;
  locale?: 'de_DE' | 'en_US';
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

const SITE_NAME = 'VeloCal';
const TITLE_SUFFIX = ' — VeloCal';
const DEFAULT_IMAGE = '/icon-512.png';
const DEFAULT_DESCRIPTION = 'VeloCal — Cycling event calendar';
const JSON_LD_ID = 'seo-jsonld';
/** Safety net when no SITE_URL is provided (should not happen in prod). */
const FALLBACK_ORIGIN = 'https://velocal.cc';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  readonly siteUrl = inject(SITE_URL);

  setMeta(input: SeoMeta): void {
    const title = this.formatTitle(input.title);
    const description = input.description || DEFAULT_DESCRIPTION;
    const image = this.absolute(input.image ?? DEFAULT_IMAGE);

    this.title.setTitle(title);

    this.upsertName('description', description);
    this.upsertProp('og:site_name', SITE_NAME);
    this.upsertProp('og:title', title);
    this.upsertProp('og:description', description);
    this.upsertProp('og:type', input.type ?? 'website');
    this.upsertProp('og:image', image);
    this.upsertProp('og:locale', input.locale ?? 'de_DE');
    if (input.url) this.upsertProp('og:url', input.url);
    if (input.publishedAt) this.upsertProp('article:published_time', input.publishedAt);
    if (input.modifiedAt) this.upsertProp('article:modified_time', input.modifiedAt);

    this.upsertName('twitter:card', 'summary_large_image');
    this.upsertName('twitter:title', title);
    this.upsertName('twitter:description', description);
    this.upsertName('twitter:image', image);

    this.setCanonical(input.url);
    this.setRobots(input.noindex ?? false);
    this.setJsonLd(input.jsonLd);
  }

  reset(): void {
    this.setMeta({ title: SITE_NAME, description: DEFAULT_DESCRIPTION, type: 'website' });
  }

  /**
   * Build an absolute page URL for canonical/og:url.
   * Returns `undefined` when no origin is available so callers pass `undefined` to `setMeta`
   * (which then skips emitting a relative canonical).
   */
  pageUrl(path: string): string | undefined {
    const base = this.siteUrl;
    if (!base) return undefined;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  private formatTitle(title: string): string {
    if (!title || title === SITE_NAME) return SITE_NAME;
    return title.includes(SITE_NAME) ? title : title + TITLE_SUFFIX;
  }

  private upsertName(name: string, content: string): void {
    this.meta.updateTag({ name, content }, `name="${name}"`);
  }

  private upsertProp(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property="${property}"`);
  }

  absolute(url: string): string {
    if (/^https?:\/\//.test(url)) return url;
    const base = this.siteUrl || FALLBACK_ORIGIN;
    return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
  }

  private setCanonical(url?: string): void {
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setRobots(noindex: boolean): void {
    this.meta.updateTag(
      { name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow' },
      'name="robots"',
    );
  }

  private setJsonLd(jsonLd?: Record<string, unknown>): void {
    const existing = this.doc.getElementById(JSON_LD_ID);
    if (existing) existing.remove();
    if (!jsonLd) return;

    const script = this.doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.id = JSON_LD_ID;
    // Escape `<` to neutralise `</script>` + `<!--` breakouts when JSON values contain user input.
    script.textContent = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    this.doc.head.appendChild(script);
  }
}

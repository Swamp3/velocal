import { Controller, Get, Header, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { Event, EventStatus } from '../events/entities/event.entity';
import { Post, PostStatus } from '../posts/entities/post.entity';
import { RaceSeries } from '../series/entities/race-series.entity';

const ARCHIVE_CUTOFF_DAYS = 90;
/** Per-file URL cap per sitemaps.org. We stay well under 50k to leave headroom. */
const MAX_URLS_PER_FILE = 45_000;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface UrlEntryInput {
  loc: string;
  lastmod?: Date | string | null;
  changefreq?: string;
  priority?: number;
}

function urlEntry({ loc, lastmod, changefreq, priority }: UrlEntryInput): string {
  const parts = [`    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) {
    const d = lastmod instanceof Date ? lastmod : new Date(lastmod);
    if (!Number.isNaN(d.getTime())) parts.push(`    <lastmod>${d.toISOString()}</lastmod>`);
  }
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority != null) parts.push(`    <priority>${priority.toFixed(1)}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

function wrapUrlset(entries: string[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>\n'
  );
}

function wrapSitemapIndex(entries: Array<{ loc: string; lastmod?: Date }>): string {
  const body = entries
    .map(({ loc, lastmod }) => {
      const parts = [`    <loc>${xmlEscape(loc)}</loc>`];
      if (lastmod) parts.push(`    <lastmod>${lastmod.toISOString()}</lastmod>`);
      return `  <sitemap>\n${parts.join('\n')}\n  </sitemap>`;
    })
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '\n</sitemapindex>\n'
  );
}

@Controller('seo')
export class SitemapController {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(RaceSeries) private readonly series: Repository<RaceSeries>,
  ) {}

  private siteUrl(): string {
    return (this.config.get<string>('SITE_URL') ?? 'https://velocal.cc').replace(/\/$/, '');
  }

  /** Sitemap index — points at the static + per-collection shards. */
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  sitemapIndex(@Res() res: Response): void {
    const site = this.siteUrl();
    const now = new Date();
    res.send(
      wrapSitemapIndex([
        { loc: `${site}/sitemap-static.xml`, lastmod: now },
        { loc: `${site}/sitemap-events.xml`, lastmod: now },
        { loc: `${site}/sitemap-series.xml`, lastmod: now },
        { loc: `${site}/sitemap-posts.xml`, lastmod: now },
      ]),
    );
  }

  @Get('sitemap-static.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  sitemapStatic(@Res() res: Response): void {
    const site = this.siteUrl();
    const entries: string[] = [
      urlEntry({ loc: `${site}/`, changefreq: 'daily', priority: 1.0 }),
      urlEntry({ loc: `${site}/events`, changefreq: 'daily', priority: 0.9 }),
      urlEntry({ loc: `${site}/map`, changefreq: 'daily', priority: 0.6 }),
      urlEntry({ loc: `${site}/calendar`, changefreq: 'daily', priority: 0.6 }),
      urlEntry({ loc: `${site}/series`, changefreq: 'weekly', priority: 0.7 }),
      urlEntry({ loc: `${site}/news`, changefreq: 'daily', priority: 0.7 }),
    ];
    res.send(wrapUrlset(entries));
  }

  @Get('sitemap-events.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async sitemapEvents(@Res() res: Response): Promise<void> {
    const site = this.siteUrl();
    const cutoff = new Date(Date.now() - ARCHIVE_CUTOFF_DAYS * 24 * 60 * 60 * 1000);
    const events = await this.events.find({
      where: { status: EventStatus.PUBLISHED, startDate: MoreThanOrEqual(cutoff) },
      select: ['id', 'updatedAt', 'startDate'],
      order: { startDate: 'DESC' },
      take: MAX_URLS_PER_FILE,
    });
    const entries = events.map((e) =>
      urlEntry({
        loc: `${site}/events/${e.id}`,
        lastmod: e.updatedAt ?? e.startDate,
        changefreq: 'weekly',
        priority: 0.8,
      }),
    );
    res.send(wrapUrlset(entries));
  }

  @Get('sitemap-series.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async sitemapSeries(@Res() res: Response): Promise<void> {
    const site = this.siteUrl();
    const series = await this.series.find({
      select: ['slug', 'updatedAt'],
      take: MAX_URLS_PER_FILE,
    });
    const entries = series.map((s) =>
      urlEntry({
        loc: `${site}/series/${s.slug}`,
        lastmod: s.updatedAt,
        changefreq: 'weekly',
        priority: 0.6,
      }),
    );
    res.send(wrapUrlset(entries));
  }

  @Get('sitemap-posts.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async sitemapPosts(@Res() res: Response): Promise<void> {
    const site = this.siteUrl();
    const posts = await this.posts.find({
      where: { status: PostStatus.PUBLISHED, publishedAt: LessThanOrEqual(new Date()) },
      select: ['slug', 'updatedAt'],
      take: MAX_URLS_PER_FILE,
    });
    const entries = posts.map((p) =>
      urlEntry({
        loc: `${site}/news/${p.slug}`,
        lastmod: p.updatedAt,
        changefreq: 'weekly',
        priority: 0.6,
      }),
    );
    res.send(wrapUrlset(entries));
  }
}

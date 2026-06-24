import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageView } from './entities/page-view.entity';

export interface TopPage {
  path: string;
  views: number;
}

export interface AnalyticsOverview {
  totalViews: number;
  uniquePaths: number;
  viewsPerDay: { date: string; views: number }[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(PageView)
    private readonly pageViewRepo: Repository<PageView>,
  ) {}

  async recordPageView(path: string, userId?: string): Promise<void> {
    await this.pageViewRepo.insert({
      path,
      userId: userId ?? null,
    });
  }

  async getTopPages(days = 30, limit = 20): Promise<TopPage[]> {
    const rows = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select('pv.path', 'path')
      .addSelect('COUNT(*)::int', 'views')
      .where("pv.viewedAt > NOW() - :interval::interval", {
        interval: `${days} days`,
      })
      .groupBy('pv.path')
      .orderBy('views', 'DESC')
      .limit(limit)
      .getRawMany<TopPage>();

    return rows;
  }

  async getOverview(days = 30): Promise<AnalyticsOverview> {
    const since = `${days} days`;

    const [{ totalViews }] = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select('COUNT(*)::int', 'totalViews')
      .where("pv.viewedAt > NOW() - :since::interval", { since })
      .getRawMany<{ totalViews: number }>();

    const [{ uniquePaths }] = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select('COUNT(DISTINCT pv.path)::int', 'uniquePaths')
      .where("pv.viewedAt > NOW() - :since::interval", { since })
      .getRawMany<{ uniquePaths: number }>();

    const viewsPerDay = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select("TO_CHAR(pv.viewedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)::int', 'views')
      .where("pv.viewedAt > NOW() - :since::interval", { since })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; views: number }>();

    return { totalViews, uniquePaths, viewsPerDay };
  }
}

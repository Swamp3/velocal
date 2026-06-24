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
  uniqueClients: number;
  viewsPerDay: { date: string; views: number }[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(PageView)
    private readonly pageViewRepo: Repository<PageView>,
  ) {}

  async recordPageView(path: string, userId?: string, clientId?: string): Promise<void> {
    await this.pageViewRepo.insert({
      path,
      userId: userId ?? null,
      clientId: clientId ?? null,
    });
  }

  async getTopPages(days = 30, limit = 20): Promise<TopPage[]> {
    const rows = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select('pv.path', 'path')
      .addSelect('COUNT(*)::int', 'views')
      .where('pv.viewedAt > NOW() - CAST(:days AS interval)', {
        days: `${days} days`,
      })
      .groupBy('pv.path')
      .orderBy('COUNT(*)', 'DESC')
      .limit(limit)
      .getRawMany<TopPage>();

    return rows;
  }

  async getOverview(days = 30): Promise<AnalyticsOverview> {
    const interval = `${days} days`;

    const totalResult = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select('COUNT(*)::int', 'totalViews')
      .where('pv.viewedAt > NOW() - CAST(:interval AS interval)', { interval })
      .getRawOne<{ totalViews: number }>();

    const uniqueResult = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select('COUNT(DISTINCT pv.path)::int', 'uniquePaths')
      .where('pv.viewedAt > NOW() - CAST(:interval AS interval)', { interval })
      .getRawOne<{ uniquePaths: number }>();

    const clientsResult = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select('COUNT(DISTINCT pv.clientId)::int', 'uniqueClients')
      .where('pv.viewedAt > NOW() - CAST(:interval AS interval)', { interval })
      .getRawOne<{ uniqueClients: number }>();

    const viewsPerDay = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select("TO_CHAR(pv.viewedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)::int', 'views')
      .where('pv.viewedAt > NOW() - CAST(:interval AS interval)', { interval })
      .groupBy("TO_CHAR(pv.viewedAt, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(pv.viewedAt, 'YYYY-MM-DD')", 'ASC')
      .getRawMany<{ date: string; views: number }>();

    return {
      totalViews: totalResult?.totalViews ?? 0,
      uniquePaths: uniqueResult?.uniquePaths ?? 0,
      uniqueClients: clientsResult?.uniqueClients ?? 0,
      viewsPerDay,
    };
  }
}

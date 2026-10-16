import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PageView } from './entities/page-view.entity';

export interface TopPage {
  path: string;
  views: number;
}

export interface DailyStats {
  date: string;
  views: number;
  uniqueClients: number;
}

export interface AnalyticsOverview {
  totalViews: number;
  uniquePaths: number;
  uniqueClients: number;
  daily: DailyStats[];
}

/** Page views older than this are deleted (see the privacy policy). */
export const PAGE_VIEW_RETENTION_DAYS = 400;

@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(PageView)
    private readonly pageViewRepo: Repository<PageView>,
  ) {}

  onModuleInit(): void {
    void this.deleteExpired();
    this.cleanupTimer = setInterval(
      () => void this.deleteExpired(),
      24 * 60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  async deleteExpired(): Promise<void> {
    try {
      const cutoff = new Date(
        Date.now() - PAGE_VIEW_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      await this.pageViewRepo.delete({ viewedAt: LessThan(cutoff) });
    } catch (error) {
      this.logger.error('Deleting expired page views failed', error);
    }
  }

  async recordPageView(path: string, clientId?: string): Promise<void> {
    await this.pageViewRepo.insert({
      path,
      userId: null,
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

    const daily = await this.pageViewRepo
      .createQueryBuilder('pv')
      .select("TO_CHAR(pv.viewedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)::int', 'views')
      .addSelect('COUNT(DISTINCT pv.clientId)::int', 'uniqueClients')
      .where('pv.viewedAt > NOW() - CAST(:interval AS interval)', { interval })
      .groupBy("TO_CHAR(pv.viewedAt, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(pv.viewedAt, 'YYYY-MM-DD')", 'ASC')
      .getRawMany<DailyStats>();

    return {
      totalViews: totalResult?.totalViews ?? 0,
      uniquePaths: uniqueResult?.uniquePaths ?? 0,
      uniqueClients: clientsResult?.uniqueClients ?? 0,
      daily,
    };
  }
}

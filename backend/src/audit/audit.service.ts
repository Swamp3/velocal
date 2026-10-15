import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AdminAuditLog } from './audit-log.entity';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  communityId?: string;
  details?: Record<string, unknown>;
}

export interface AuditQuery {
  q?: string;
  action?: string;
  page: number;
  limit: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly log: Repository<AdminAuditLog>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Never throws: a failed log write must not undo an action that already happened. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const actor = entry.actorId
        ? await this.users.findOne({
            where: { id: entry.actorId },
            select: { id: true, displayName: true, email: true },
          })
        : null;
      await this.log.insert({
        actorId: entry.actorId,
        actorLabel: actor?.displayName || actor?.email || 'system',
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        targetLabel: entry.targetLabel?.slice(0, 300) ?? null,
        communityId: entry.communityId ?? null,
        details: (entry.details ?? null) as AdminAuditLog['details'] & object,
      });
    } catch (err) {
      this.logger.error(
        `Could not write audit entry ${entry.action}`,
        err as Error,
      );
    }
  }

  async list(query: AuditQuery) {
    const qb = this.log
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');
    if (query.action)
      qb.andWhere('log.action = :action', { action: query.action });
    if (query.q) {
      qb.andWhere(
        '(log.actorLabel ILIKE :q OR log.targetLabel ILIKE :q OR log.action ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }
    qb.skip((query.page - 1) * query.limit).take(query.limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page: query.page, limit: query.limit };
  }
}

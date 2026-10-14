import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { imageAccessMatches, signImageUrl } from './image-access';

export type ImageRestriction = 'public' | 'signed' | 'hidden';

@Injectable()
export class ImageAccessService {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  sign(url: string | null, restricted: boolean): string | null {
    return signImageUrl(url, restricted, this.secret());
  }

  matches(subject: string, id: string, token: string | undefined): boolean {
    return imageAccessMatches(subject, id, token, this.secret());
  }

  /**
   * Community and subgroup images share upload subjects. A private community,
   * or an invite-only subgroup, is not fetchable from the bare file URL.
   * Members-only event images use the same signed query. Public events, series,
   * and news images stay public.
   */
  async restriction(subject: string, id: string): Promise<ImageRestriction> {
    if (subject === 'events') {
      const rows: Array<{ listing: string }> = await this.dataSource.query(
        `SELECT "listing"::text AS "listing" FROM "events" WHERE "id" = $1`,
        [id],
      );
      if (rows.length === 0) return 'hidden';
      return rows[0].listing === 'members' ? 'signed' : 'public';
    }

    if (subject !== 'community-heroes' && subject !== 'community-logos') {
      return 'public';
    }

    const rows: Array<{ restricted: boolean }> = await this.dataSource.query(
      `SELECT restricted FROM (
         SELECT 1 AS ord, (c."visibility" = 'private') AS restricted
         FROM "communities" c
         WHERE c."id" = $1
         UNION ALL
         SELECT 2, (c."visibility" = 'private' OR s."visibility" = 'invite')
         FROM "subgroups" s
         INNER JOIN "communities" c ON c."id" = s."community_id"
         WHERE s."id" = $1
       ) AS media
       ORDER BY ord
       LIMIT 1`,
      [id],
    );

    if (rows.length === 0) return 'hidden';
    return rows[0].restricted ? 'signed' : 'public';
  }

  private secret(): string {
    return this.config.get<string>('jwt.secret') ?? 'dev-secret-change-me';
  }
}

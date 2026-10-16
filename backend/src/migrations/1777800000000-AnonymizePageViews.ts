import { MigrationInterface, QueryRunner } from 'typeorm';

/** Page views no longer carry the account: drop the link from existing rows. */
export class AnonymizePageViews1777800000000 implements MigrationInterface {
  name = 'AnonymizePageViews1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "page_views" SET "userId" = NULL`);
  }

  public async down(): Promise<void> {
    // The removed account links cannot be restored.
  }
}

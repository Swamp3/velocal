import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds optional `imageUrl` columns to events and posts so they can store a
 * relative path (e.g. `/api/uploads/events/{id}/hero.webp?v=…`) to their
 * uploaded hero image. Race series already has an `imageUrl` column from
 * `1774700000000-AddRaceSeries`; we just reuse it.
 */
export class AddImageUrls1775000000000 implements MigrationInterface {
  name = 'AddImageUrls1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD "imageUrl" character varying`);
    await queryRunner.query(`ALTER TABLE "posts" ADD "imageUrl" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "imageUrl"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "imageUrl"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityPostTitles1776200000000 implements MigrationInterface {
  name = 'AddCommunityPostTitles1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_posts" ADD "title" character varying(200)`,
    );
    await queryRunner.query(`
      UPDATE "community_posts"
      SET "title" = left(
        btrim(regexp_replace(regexp_replace(replace("body", '&nbsp;', ' '), '<[^>]+>', ' ', 'g'), '\\s+', ' ', 'g')),
        200
      )
    `);
    await queryRunner.query(`
      UPDATE "community_posts" SET "title" = 'Beitrag' WHERE "title" IS NULL OR "title" = ''
    `);
    await queryRunner.query(
      `ALTER TABLE "community_posts" ALTER COLUMN "title" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_posts" DROP COLUMN "title"`,
    );
  }
}

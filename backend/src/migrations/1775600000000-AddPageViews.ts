import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageViews1775600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "page_views" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "path" character varying(500) NOT NULL,
        "userId" uuid,
        "viewedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_page_views" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_page_views_path" ON "page_views" ("path")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_page_views_viewedAt" ON "page_views" ("viewedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_page_views_viewedAt"`);
    await queryRunner.query(`DROP INDEX "IDX_page_views_path"`);
    await queryRunner.query(`DROP TABLE "page_views"`);
  }
}

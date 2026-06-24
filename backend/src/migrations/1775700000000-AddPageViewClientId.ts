import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageViewClientId1775700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "page_views" ADD "clientId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_page_views_clientId" ON "page_views" ("clientId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_page_views_clientId"`);
    await queryRunner.query(
      `ALTER TABLE "page_views" DROP COLUMN "clientId"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPreferredLanguage1775200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "preferredLanguage" character varying NOT NULL DEFAULT 'de'`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "preferredLanguage" = "preferredLocale"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "preferredLanguage"`,
    );
  }
}

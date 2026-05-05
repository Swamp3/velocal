import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImportTriggeredBy1775500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "import_runs" ADD "triggeredBy" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "import_runs" DROP COLUMN "triggeredBy"`,
    );
  }
}

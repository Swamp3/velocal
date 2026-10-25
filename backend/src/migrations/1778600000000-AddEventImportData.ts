import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data the event import needs to be safe and complete: whether the start time is known, the
 * sources and conflicts of an event, the import run that created it and the fields a person
 * edited by hand (never overwritten by imports).
 *
 * It also repairs day-only dates: the scrapers stored them as midnight UTC, which German
 * browsers show as 01:00 or 02:00. They become midnight in Europe/Berlin with
 * `start_time_known = false`.
 */
export class AddEventImportData1778600000000 implements MigrationInterface {
  name = 'AddEventImportData1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "start_time_known" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "sources" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "events" ADD "import_conflicts" jsonb`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "import_run_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "events" ADD "edited_fields" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_events_import_run" FOREIGN KEY ("import_run_id") REFERENCES "import_runs"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_events_import_run_id" ON "events" ("import_run_id")`,
    );
    await queryRunner.query(`ALTER TABLE "import_runs" ADD "report" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "import_runs" ADD "file_name" character varying(255)`,
    );

    // Scraped day-only dates: midnight UTC → midnight Europe/Berlin, time unknown.
    await queryRunner.query(`
      UPDATE "events"
         SET "startDate" = (("startDate" AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'Europe/Berlin'),
             "start_time_known" = false
       WHERE "source" = 'imported'
         AND ("startDate" AT TIME ZONE 'UTC')::time = '00:00'`);
    await queryRunner.query(`
      UPDATE "events"
         SET "endDate" = (("endDate" AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'Europe/Berlin')
       WHERE "source" = 'imported'
         AND "endDate" IS NOT NULL
         AND ("endDate" AT TIME ZONE 'UTC')::time = '00:00'`);
    // Everything else at local midnight was entered without a time.
    await queryRunner.query(`
      UPDATE "events" SET "start_time_known" = false
       WHERE ("startDate" AT TIME ZONE 'Europe/Berlin')::time = '00:00'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "events"
         SET "startDate" = (("startDate" AT TIME ZONE 'Europe/Berlin')::date::timestamp AT TIME ZONE 'UTC')
       WHERE "source" = 'imported' AND "start_time_known" = false`);
    await queryRunner.query(
      `ALTER TABLE "import_runs" DROP COLUMN "file_name"`,
    );
    await queryRunner.query(`ALTER TABLE "import_runs" DROP COLUMN "report"`);
    await queryRunner.query(`DROP INDEX "IDX_events_import_run_id"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_events_import_run"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "edited_fields"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "import_run_id"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "import_conflicts"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "sources"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "start_time_known"`,
    );
  }
}

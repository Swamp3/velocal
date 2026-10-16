import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventSourceTracking1778100000000 implements MigrationInterface {
  name = 'AddEventSourceTracking1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "sourceName" character varying(40)`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "sourceUrl" text`);
    await queryRunner.query(
      `ALTER TABLE "events" ADD "lastSeenAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "missingSince" TIMESTAMP WITH TIME ZONE`,
    );
    // Which scraper created the existing imported events: race-result ids start with "rr-".
    await queryRunner.query(
      `UPDATE "events" SET
         "sourceName" = CASE WHEN "externalId" LIKE 'rr-%' THEN 'race-result' ELSE 'rad-net' END,
         "sourceUrl" = "externalUrl"
       WHERE "source" = 'imported'`,
    );
    // Not unique on purpose: existing duplicates would block the migration.
    await queryRunner.query(
      `CREATE INDEX "IDX_events_source_external" ON "events" ("sourceName", "externalId")
       WHERE "sourceName" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "event_duplicate_ignores" (
        "event_a_id" uuid NOT NULL,
        "event_b_id" uuid NOT NULL,
        "created_by_id" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_duplicate_ignores" PRIMARY KEY ("event_a_id", "event_b_id"),
        CONSTRAINT "CHK_event_duplicate_ignores_order" CHECK ("event_a_id" < "event_b_id"),
        CONSTRAINT "FK_event_duplicate_ignores_a" FOREIGN KEY ("event_a_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_duplicate_ignores_b" FOREIGN KEY ("event_b_id") REFERENCES "events"("id") ON DELETE CASCADE
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_duplicate_ignores"`);
    await queryRunner.query(`DROP INDEX "IDX_events_source_external"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "missingSince"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "lastSeenAt"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "sourceUrl"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "sourceName"`);
  }
}

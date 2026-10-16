import { MigrationInterface, QueryRunner } from 'typeorm';

/** Indexes for the lookups added with RSVP overview, importer and event lists. */
export class AddQueryIndexes1778200000000 implements MigrationInterface {
  name = 'AddQueryIndexes1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_rsvps_user_id" ON "event_rsvps" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_events_start_date" ON "events" ("startDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_events_source_url" ON "events" ("sourceUrl")
       WHERE "sourceUrl" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_events_external_url" ON "events" ("externalUrl")
       WHERE "externalUrl" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_external_url"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_source_url"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_start_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_rsvps_user_id"`);
  }
}

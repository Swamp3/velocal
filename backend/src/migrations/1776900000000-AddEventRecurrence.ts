import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventRecurrence1776900000000 implements MigrationInterface {
  name = 'AddEventRecurrence1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_recurrences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "frequency" character varying(20) NOT NULL,
        "timezone" character varying(64) NOT NULL,
        "created_by_id" uuid,
        "ended_at" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_recurrences" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "events" ADD "recurrence_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_events_recurrence" FOREIGN KEY ("recurrence_id") REFERENCES "event_recurrences"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_events_recurrence_id" ON "events" ("recurrence_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_events_recurrence_id"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_events_recurrence"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "recurrence_id"`);
    await queryRunner.query(`DROP TABLE "event_recurrences"`);
  }
}

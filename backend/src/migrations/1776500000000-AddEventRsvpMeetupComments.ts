import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventRsvpMeetupComments1776500000000 implements MigrationInterface {
  name = 'AddEventRsvpMeetupComments1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "meetup_place" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "meetup_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "meetup_note" text`);
    await queryRunner.query(
      `CREATE TYPE "event_rsvp_status" AS ENUM('going', 'maybe', 'declined')`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_rsvps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "event_rsvp_status" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_rsvps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_rsvps_event_user" UNIQUE ("event_id", "user_id"),
        CONSTRAINT "FK_event_rsvps_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_rsvps_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_rsvps_event_id" ON "event_rsvps" ("event_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_comments_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_comments_event_id" ON "event_comments" ("event_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_event_comments_event_id"`);
    await queryRunner.query(`DROP TABLE "event_comments"`);
    await queryRunner.query(`DROP INDEX "IDX_event_rsvps_event_id"`);
    await queryRunner.query(`DROP TABLE "event_rsvps"`);
    await queryRunner.query(`DROP TYPE "event_rsvp_status"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "meetup_note"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "meetup_at"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "meetup_place"`);
  }
}

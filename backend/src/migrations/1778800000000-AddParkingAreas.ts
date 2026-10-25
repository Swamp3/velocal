import { MigrationInterface, QueryRunner } from 'typeorm';

/** Parking areas of an event (see `events/parking.ts`): a point with kinds, fee and opening times. */
export class AddParkingAreas1778800000000 implements MigrationInterface {
  name = 'AddParkingAreas1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "parking_fee" AS ENUM('free', 'paid')`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_parking_areas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "name" character varying(80) NOT NULL,
        "kinds" text array NOT NULL,
        "coordinates" geography(Point,4326) NOT NULL,
        "address" character varying(255),
        "capacity" integer,
        "fee" "parking_fee",
        "fee_note" character varying(80),
        "open_from" character varying(5),
        "open_until" character varying(5),
        "note" character varying(300),
        CONSTRAINT "PK_event_parking_areas" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_parking_areas_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_parking_areas_event_id" ON "event_parking_areas" ("event_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_parking_areas"`);
    await queryRunner.query(`DROP TYPE "parking_fee"`);
  }
}

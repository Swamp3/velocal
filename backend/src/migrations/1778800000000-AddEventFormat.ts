import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Event format (licence race, Jedermann, RTF, CTF, Radmarathon, brevet, gravel ride, tour) and
 * distance and climbing per class, so touring events can list their routes. Fills the format of
 * existing events only where the name states it clearly.
 */
export class AddEventFormat1778800000000 implements MigrationInterface {
  name = 'AddEventFormat1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "event_format" AS ENUM('race', 'jedermann', 'rtf', 'ctf', 'marathon', 'brevet', 'gravel_ride', 'tour')`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "format" "event_format"`);
    await queryRunner.query(
      `ALTER TABLE "event_classes" ADD "distance_km" numeric(6,1)`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_classes" ADD "elevation_m" integer`,
    );
    // Same rules as inferFormat(), in the same order.
    await queryRunner.query(`
      UPDATE "events" SET "format" = CASE
        WHEN "name" ~* '(^|[^[:alnum:]])RTF([^[:alnum:]]|$)' OR "name" ~* 'Radtourenfahrt' THEN 'rtf'
        WHEN "name" ~* '(^|[^[:alnum:]])CTF([^[:alnum:]]|$)' OR "name" ~* 'Country[- ]?Tour' THEN 'ctf'
        WHEN "name" ~* 'Radmarathon' THEN 'marathon'
        WHEN "name" ~* '(^|[^[:alnum:]])(Brevet|Audax)([^[:alnum:]]|$)' OR "name" ~* 'Randonn' THEN 'brevet'
        WHEN "name" ~* 'Jedermann|Jederfrau|Gran ?Fondo' THEN 'jedermann'
        WHEN "name" ~* 'Gravel[- ]?(Ride|Tour|Fahrt)' THEN 'gravel_ride'
        WHEN "name" ~* 'Radwander|Volksradfahr' THEN 'tour'
      END::"event_format"
      WHERE "format" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_classes" DROP COLUMN "elevation_m"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_classes" DROP COLUMN "distance_km"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "format"`);
    await queryRunner.query(`DROP TYPE "event_format"`);
  }
}

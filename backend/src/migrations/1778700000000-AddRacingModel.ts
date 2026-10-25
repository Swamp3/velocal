import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The racing model (see `events/racing.ts`): rating classes and routes per event (age category,
 * gender, licence, day licence, licence classes, distance, climbing), championship level, event
 * format (licence race, Jedermann, kids' race, RTF, CTF, Radmarathon, brevet, gravel ride, tour),
 * series kinds (cup, league with season) and the rider data the "fits me" filter needs.
 *
 * Existing events get their format where the name states it clearly (same rules as
 * `inferFormat`), and "Breitensport" events of a known format their bike type (same as
 * `disciplineFor`). The value lists are copies on purpose: a migration must not change once
 * released.
 */
export class AddRacingModel1778700000000 implements MigrationInterface {
  name = 'AddRacingModel1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "event_class_gender" AS ENUM('open', 'male', 'female')`,
    );
    await queryRunner.query(
      `CREATE TYPE "event_class_license" AS ENUM('open', 'unlicensed', 'license', 'uci')`,
    );
    await queryRunner.query(
      `CREATE TYPE "championship_level" AS ENUM('club', 'district', 'state', 'regional', 'national', 'continental', 'world')`,
    );
    await queryRunner.query(
      `CREATE TYPE "event_format" AS ENUM('race', 'jedermann', 'kids', 'rtf', 'ctf', 'marathon', 'brevet', 'gravel_ride', 'tour')`,
    );
    await queryRunner.query(
      `CREATE TYPE "series_kind" AS ENUM('series', 'cup', 'league')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_gender" AS ENUM('male', 'female', 'diverse')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_license" AS ENUM('none', 'license', 'uci')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_license_class" AS ENUM('elite_amateur', 'amateur', 'master')`,
    );

    await queryRunner.query(`
      CREATE TABLE "event_classes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "name" character varying(120) NOT NULL,
        "gender" "event_class_gender" NOT NULL DEFAULT 'open',
        "age_min" integer,
        "age_max" integer,
        "category" character varying(20),
        "license" "event_class_license" NOT NULL DEFAULT 'open',
        "day_license" boolean NOT NULL DEFAULT false,
        "license_classes" text array,
        "distance_km" numeric(6,1),
        "elevation_m" integer,
        "start_time" TIMESTAMP WITH TIME ZONE,
        "championship" "championship_level",
        "note" character varying(300),
        CONSTRAINT "PK_event_classes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_classes_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_classes_event_id" ON "event_classes" ("event_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "championship" "championship_level"`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "format" "event_format"`);

    await queryRunner.query(
      `ALTER TABLE "race_series" ADD "kind" "series_kind" NOT NULL DEFAULT 'series'`,
    );
    await queryRunner.query(
      `ALTER TABLE "race_series" ADD "season" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "race_series" ADD "source_name" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "race_series" ADD "external_key" character varying(200)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_race_series_source_key" ON "race_series" ("source_name", "external_key") WHERE "source_name" IS NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE "users" ADD "birth_year" integer`);
    await queryRunner.query(`ALTER TABLE "users" ADD "gender" "user_gender"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "license_type" "user_license"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "license_class" "user_license_class"`,
    );

    // Format from a clear name; the first matching rule wins, kids' races last.
    await queryRunner.query(`
      UPDATE "events" SET "format" = CASE
        WHEN "name" ~* '(^|[^[:alnum:]])RTF([^[:alnum:]]|$)' OR "name" ~* 'Radtourenfahrt' THEN 'rtf'
        WHEN "name" ~* '(^|[^[:alnum:]])CTF([^[:alnum:]]|$)' OR "name" ~* 'Country[- ]?Tour' THEN 'ctf'
        WHEN "name" ~* 'Radmarathon' THEN 'marathon'
        WHEN "name" ~* '(^|[^[:alnum:]])Brevet' OR "name" ~* '(^|[^[:alnum:]])Audax([^[:alnum:]]|$)'
          OR "name" ~* 'Randonn' OR "name" ~* '^ARA([^[:alnum:]]|$)' THEN 'brevet'
        WHEN "name" ~* 'Jedermann|Jederfrau|Gran ?Fondo' THEN 'jedermann'
        WHEN "name" ~* 'Gravel[- ]?(Ride|Tour|Fahrt)' THEN 'gravel_ride'
        WHEN "name" ~* 'Radwander|Volksradfahr' THEN 'tour'
        WHEN "name" ~* 'Fette[- ]?Reifen|Laufrad[- ]?Rennen|Kinder[- ]?Rennen|Kids[- ]?(Race|Rennen|Cup)|Bambini' THEN 'kids'
      END::"event_format"`);
    // "Breitensport" events of a known format get their bike type.
    await queryRunner.query(`
      UPDATE "events" SET "discipline_slug" = CASE "format"
        WHEN 'rtf' THEN 'strasse' WHEN 'marathon' THEN 'strasse' WHEN 'brevet' THEN 'strasse'
        WHEN 'ctf' THEN 'mtb' WHEN 'gravel_ride' THEN 'gravel'
      END
      WHERE "discipline_slug" = 'breitensport'
        AND "format" IN ('rtf', 'marathon', 'brevet', 'ctf', 'gravel_ride')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Bike types given to "Breitensport" events stay: the former value is not known.
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "license_class"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "license_type"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gender"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "birth_year"`);
    await queryRunner.query(`DROP INDEX "UQ_race_series_source_key"`);
    await queryRunner.query(
      `ALTER TABLE "race_series" DROP COLUMN "external_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "race_series" DROP COLUMN "source_name"`,
    );
    await queryRunner.query(`ALTER TABLE "race_series" DROP COLUMN "season"`);
    await queryRunner.query(`ALTER TABLE "race_series" DROP COLUMN "kind"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "format"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "championship"`);
    await queryRunner.query(`DROP TABLE "event_classes"`);
    for (const type of [
      'user_license_class',
      'user_license',
      'user_gender',
      'series_kind',
      'event_format',
      'championship_level',
      'event_class_license',
      'event_class_gender',
    ]) {
      await queryRunner.query(`DROP TYPE "${type}"`);
    }
  }
}

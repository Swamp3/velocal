import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rating classes per event (age, gender, licence), championship level, series kinds (cup, league
 * with season) and the rider data a personal class filter needs (year of birth, gender, licence).
 */
export class AddEventClasses1778700000000 implements MigrationInterface {
  name = 'AddEventClasses1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "event_class_gender" AS ENUM('open', 'male', 'female')`);
    await queryRunner.query(`CREATE TYPE "event_class_license" AS ENUM('none', 'hobby', 'license')`);
    await queryRunner.query(
      `CREATE TYPE "championship_level" AS ENUM('club', 'district', 'state', 'regional', 'national', 'continental', 'world')`,
    );
    await queryRunner.query(`CREATE TYPE "series_kind" AS ENUM('series', 'cup', 'league')`);
    await queryRunner.query(`CREATE TYPE "user_gender" AS ENUM('male', 'female', 'diverse')`);
    await queryRunner.query(`CREATE TYPE "user_license" AS ENUM('none', 'hobby', 'license')`);

    await queryRunner.query(`
      CREATE TABLE "event_classes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "name" character varying(120) NOT NULL,
        "gender" "event_class_gender" NOT NULL DEFAULT 'open',
        "age_min" integer,
        "age_max" integer,
        "license" "event_class_license" NOT NULL DEFAULT 'none',
        "start_time" TIMESTAMP WITH TIME ZONE,
        "championship" "championship_level",
        "note" character varying(300),
        CONSTRAINT "PK_event_classes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_classes_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_event_classes_event_id" ON "event_classes" ("event_id")`);
    await queryRunner.query(`ALTER TABLE "events" ADD "championship" "championship_level"`);

    await queryRunner.query(`ALTER TABLE "race_series" ADD "kind" "series_kind" NOT NULL DEFAULT 'series'`);
    await queryRunner.query(`ALTER TABLE "race_series" ADD "season" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "race_series" ADD "source_name" character varying(40)`);
    await queryRunner.query(`ALTER TABLE "race_series" ADD "external_key" character varying(200)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_race_series_source_key" ON "race_series" ("source_name", "external_key") WHERE "source_name" IS NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE "users" ADD "birth_year" integer`);
    await queryRunner.query(`ALTER TABLE "users" ADD "gender" "user_gender"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "license_type" "user_license"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "license_type"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gender"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "birth_year"`);
    await queryRunner.query(`DROP INDEX "UQ_race_series_source_key"`);
    await queryRunner.query(`ALTER TABLE "race_series" DROP COLUMN "external_key"`);
    await queryRunner.query(`ALTER TABLE "race_series" DROP COLUMN "source_name"`);
    await queryRunner.query(`ALTER TABLE "race_series" DROP COLUMN "season"`);
    await queryRunner.query(`ALTER TABLE "race_series" DROP COLUMN "kind"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "championship"`);
    await queryRunner.query(`DROP TABLE "event_classes"`);
    await queryRunner.query(`DROP TYPE "user_license"`);
    await queryRunner.query(`DROP TYPE "user_gender"`);
    await queryRunner.query(`DROP TYPE "series_kind"`);
    await queryRunner.query(`DROP TYPE "championship_level"`);
    await queryRunner.query(`DROP TYPE "event_class_license"`);
    await queryRunner.query(`DROP TYPE "event_class_gender"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRaceSeries1774700000000 implements MigrationInterface {
  name = 'AddRaceSeries1774700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "race_series" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "description" text,
        "year" integer,
        "discipline_slug" character varying,
        "imageUrl" character varying,
        "externalUrl" character varying,
        "created_by_id" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_race_series_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_race_series" PRIMARY KEY ("id"),
        CONSTRAINT "FK_race_series_discipline" FOREIGN KEY ("discipline_slug") REFERENCES "disciplines"("slug") ON UPDATE CASCADE ON DELETE SET NULL,
        CONSTRAINT "FK_race_series_user" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "race_series_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "series_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "stageNumber" integer,
        "label" character varying,
        CONSTRAINT "UQ_race_series_events_series_event" UNIQUE ("series_id", "event_id"),
        CONSTRAINT "PK_race_series_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_race_series_events_series" FOREIGN KEY ("series_id") REFERENCES "race_series"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_race_series_events_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_race_series_events_series" ON "race_series_events" ("series_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_race_series_events_event" ON "race_series_events" ("event_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_race_series_year" ON "race_series" ("year")`);
    await queryRunner.query(`CREATE INDEX "IDX_race_series_discipline" ON "race_series" ("discipline_slug")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_race_series_discipline"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_race_series_year"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_race_series_events_event"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_race_series_events_series"`);
    await queryRunner.query(`DROP TABLE "race_series_events"`);
    await queryRunner.query(`DROP TABLE "race_series"`);
  }
}

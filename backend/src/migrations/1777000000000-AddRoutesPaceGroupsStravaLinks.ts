import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoutesPaceGroupsStravaLinks1777000000000 implements MigrationInterface {
  name = 'AddRoutesPaceGroupsStravaLinks1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "routes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "description" text,
        "created_by_id" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_routes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_routes_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "route_files" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "route_id" uuid NOT NULL,
        "label" character varying(200) NOT NULL,
        "size_bytes" integer NOT NULL,
        "distance_m" integer,
        "ascent_m" integer,
        "bounds" jsonb,
        "sort_order" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_route_files" PRIMARY KEY ("id"),
        CONSTRAINT "FK_route_files_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_route_files_route_id" ON "route_files" ("route_id")`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "route_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_events_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_pace_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "name" character varying(80) NOT NULL,
        "category" character varying(20) NOT NULL,
        "speed_min_kmh" numeric(4,1) NOT NULL,
        "speed_max_kmh" numeric(4,1) NOT NULL,
        "route_id" uuid,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_event_pace_groups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_pace_groups_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_pace_groups_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_event_pace_groups_speed" CHECK ("speed_min_kmh" > 0 AND "speed_max_kmh" >= "speed_min_kmh")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_pace_groups_event_id" ON "event_pace_groups" ("event_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_strava_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "pace_group_id" uuid,
        "url" character varying(500) NOT NULL,
        "label" character varying(100),
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_event_strava_links" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_strava_links_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_strava_links_group" FOREIGN KEY ("pace_group_id") REFERENCES "event_pace_groups"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_strava_links_event_id" ON "event_strava_links" ("event_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_event_strava_links_event_id"`);
    await queryRunner.query(`DROP TABLE "event_strava_links"`);
    await queryRunner.query(`DROP INDEX "IDX_event_pace_groups_event_id"`);
    await queryRunner.query(`DROP TABLE "event_pace_groups"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_events_route"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "route_id"`);
    await queryRunner.query(`DROP INDEX "IDX_route_files_route_id"`);
    await queryRunner.query(`DROP TABLE "route_files"`);
    await queryRunner.query(`DROP TABLE "routes"`);
  }
}

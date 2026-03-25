import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1774433713160 implements MigrationInterface {
    name = 'InitialSchema1774433713160'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);
        await queryRunner.query(`CREATE TABLE "disciplines" ("slug" character varying NOT NULL, "nameTranslations" jsonb NOT NULL, "icon" character varying, "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_781ff03c8874511aeb9c8b12288" PRIMARY KEY ("slug"))`);
        await queryRunner.query(`CREATE TYPE "public"."events_status_enum" AS ENUM('published', 'cancelled', 'completed')`);
        await queryRunner.query(`CREATE TYPE "public"."events_source_enum" AS ENUM('manual', 'imported')`);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "startDate" TIMESTAMP WITH TIME ZONE NOT NULL, "endDate" TIMESTAMP WITH TIME ZONE, "status" "public"."events_status_enum" NOT NULL DEFAULT 'published', "locationName" character varying NOT NULL, "address" character varying, "country" character varying, "coordinates" geography(Point,4326), "registrationDeadline" TIMESTAMP WITH TIME ZONE, "externalUrl" character varying, "source" "public"."events_source_enum" NOT NULL DEFAULT 'manual', "discipline_slug" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0564a45331287ef2e46b7c21f3" ON "events" USING GiST ("coordinates") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "displayName" character varying, "homeZip" character varying, "homeCountry" character varying, "homeCoordinates" geography(Point,4326), "preferredLocale" character varying NOT NULL DEFAULT 'de', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_favorites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "eventId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e1ef05a6e60806eaf9da8837255" UNIQUE ("userId", "eventId"), CONSTRAINT "PK_6c472a19a7423cfbbf6b7c75939" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_discipline_prefs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "disciplineSlug" character varying NOT NULL, CONSTRAINT "UQ_39dba0353a20f4679e0d55b1853" UNIQUE ("userId", "disciplineSlug"), CONSTRAINT "PK_4fd105a98e27f1b953a2815d3c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_58ef047f03ee08e60dd97b19c84" FOREIGN KEY ("discipline_slug") REFERENCES "disciplines"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_favorites" ADD CONSTRAINT "FK_1dd5c393ad0517be3c31a7af836" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_favorites" ADD CONSTRAINT "FK_6c5c79bd224b4ca39152317ba16" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_discipline_prefs" ADD CONSTRAINT "FK_9efee6808e5040df73e0cec9018" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_discipline_prefs" ADD CONSTRAINT "FK_eb31a7d68573b1d1ff6b21fe2d8" FOREIGN KEY ("disciplineSlug") REFERENCES "disciplines"("slug") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_discipline_prefs" DROP CONSTRAINT "FK_eb31a7d68573b1d1ff6b21fe2d8"`);
        await queryRunner.query(`ALTER TABLE "user_discipline_prefs" DROP CONSTRAINT "FK_9efee6808e5040df73e0cec9018"`);
        await queryRunner.query(`ALTER TABLE "user_favorites" DROP CONSTRAINT "FK_6c5c79bd224b4ca39152317ba16"`);
        await queryRunner.query(`ALTER TABLE "user_favorites" DROP CONSTRAINT "FK_1dd5c393ad0517be3c31a7af836"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_58ef047f03ee08e60dd97b19c84"`);
        await queryRunner.query(`DROP TABLE "user_discipline_prefs"`);
        await queryRunner.query(`DROP TABLE "user_favorites"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0564a45331287ef2e46b7c21f3"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP TYPE "public"."events_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."events_status_enum"`);
        await queryRunner.query(`DROP TABLE "disciplines"`);
    }

}

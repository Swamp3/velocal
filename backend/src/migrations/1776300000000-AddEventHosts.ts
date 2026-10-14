import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventHosts1776300000000 implements MigrationInterface {
  name = 'AddEventHosts1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "event_listing" AS ENUM('public', 'members')`,
    );
    await queryRunner.query(`ALTER TABLE "events" ADD "community_id" uuid`);
    await queryRunner.query(`ALTER TABLE "events" ADD "subgroup_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "events" ADD "listing" "event_listing" NOT NULL DEFAULT 'public'`,
    );
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD CONSTRAINT "FK_events_community"
      FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD CONSTRAINT "FK_events_subgroup"
      FOREIGN KEY ("subgroup_id") REFERENCES "subgroups"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_events_community_id" ON "events" ("community_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_events_subgroup_id" ON "events" ("subgroup_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_events_subgroup_id"`);
    await queryRunner.query(`DROP INDEX "IDX_events_community_id"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_events_subgroup"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_events_community"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "listing"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "subgroup_id"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "community_id"`);
    await queryRunner.query(`DROP TYPE "event_listing"`);
  }
}

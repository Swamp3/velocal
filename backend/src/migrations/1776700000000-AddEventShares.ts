import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventShares1776700000000 implements MigrationInterface {
  name = 'AddEventShares1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_shares" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "community_id" uuid NOT NULL,
        "subgroup_id" uuid,
        "meetup_place" character varying(200),
        "meetup_at" TIMESTAMP WITH TIME ZONE,
        "meetup_note" text,
        "created_by_id" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_shares" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_shares_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_shares_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_shares_subgroup" FOREIGN KEY ("subgroup_id") REFERENCES "subgroups"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_shares_event_id" ON "event_shares" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_shares_community_id" ON "event_shares" ("community_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_event_shares_host" ON "event_shares"
      ("event_id", "community_id", COALESCE("subgroup_id", '00000000-0000-0000-0000-000000000000'::uuid))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_event_shares_host"`);
    await queryRunner.query(`DROP INDEX "IDX_event_shares_community_id"`);
    await queryRunner.query(`DROP INDEX "IDX_event_shares_event_id"`);
    await queryRunner.query(`DROP TABLE "event_shares"`);
  }
}

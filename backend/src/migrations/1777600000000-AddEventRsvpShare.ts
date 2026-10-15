import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventRsvpShare1777600000000 implements MigrationInterface {
  name = 'AddEventRsvpShare1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "event_rsvps" ADD "share_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "event_rsvps" DROP CONSTRAINT "UQ_event_rsvps_event_user"`,
    );
    // Keep a person's existing answer on every club share they belong to.
    // Later answers are stored per share, so the clubs can diverge.
    await queryRunner.query(`
      INSERT INTO "event_rsvps" ("event_id", "user_id", "status", "share_id", "createdAt", "updatedAt")
      SELECT r."event_id", r."user_id", r."status", s."id", r."createdAt", r."updatedAt"
      FROM "event_rsvps" r
      JOIN "event_shares" s ON s."event_id" = r."event_id"
      WHERE r."share_id" IS NULL
        AND (
          (s."subgroup_id" IS NULL AND EXISTS (
            SELECT 1 FROM "community_members" cm
            WHERE cm."community_id" = s."community_id" AND cm."user_id" = r."user_id"
          ))
          OR (s."subgroup_id" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "subgroup_members" sm
            WHERE sm."subgroup_id" = s."subgroup_id" AND sm."user_id" = r."user_id"
          ))
        )
    `);
    await queryRunner.query(`
      DELETE FROM "event_rsvps" r
      WHERE r."share_id" IS NULL
        AND EXISTS (
          SELECT 1 FROM "event_shares" s WHERE s."event_id" = r."event_id"
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "event_rsvps"
      ADD CONSTRAINT "FK_event_rsvps_share"
      FOREIGN KEY ("share_id") REFERENCES "event_shares"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_event_rsvps_share_id" ON "event_rsvps" ("share_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_event_rsvps_hosted"
      ON "event_rsvps" ("event_id", "user_id")
      WHERE "share_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_event_rsvps_share"
      ON "event_rsvps" ("event_id", "user_id", "share_id")
      WHERE "share_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_event_rsvps_share"`);
    await queryRunner.query(`DROP INDEX "UQ_event_rsvps_hosted"`);
    await queryRunner.query(`DROP INDEX "IDX_event_rsvps_share_id"`);
    await queryRunner.query(
      `ALTER TABLE "event_rsvps" DROP CONSTRAINT "FK_event_rsvps_share"`,
    );
    await queryRunner.query(
      `DELETE FROM "event_rsvps" WHERE "share_id" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "event_rsvps" DROP COLUMN "share_id"`);
    await queryRunner.query(`
      ALTER TABLE "event_rsvps"
      ADD CONSTRAINT "UQ_event_rsvps_event_user" UNIQUE ("event_id", "user_id")
    `);
  }
}

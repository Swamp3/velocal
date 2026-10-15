import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModeration1777400000000 implements MigrationInterface {
  name = 'AddModeration1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "communities" ADD "suspended_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "communities" ADD "suspended_reason" text`,
    );
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reporter_id" uuid,
        "community_id" uuid,
        "target_type" character varying(20) NOT NULL,
        "target_id" uuid NOT NULL,
        "target_label" character varying(300) NOT NULL,
        "reason" character varying(20) NOT NULL,
        "note" text,
        "status" character varying(12) NOT NULL DEFAULT 'open',
        "resolved_by_id" uuid,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "resolution_note" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_reports_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_reports_status" CHECK ("status" IN ('open', 'resolved', 'dismissed'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_status_created" ON "reports" ("status", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reports_open_per_reporter" ON "reports" ("reporter_id", "target_type", "target_id") WHERE "status" = 'open'`,
    );
    await queryRunner.query(`
      CREATE TABLE "admin_audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id" uuid,
        "actor_label" character varying(200) NOT NULL,
        "action" character varying(60) NOT NULL,
        "target_type" character varying(30),
        "target_id" uuid,
        "target_label" character varying(300),
        "community_id" uuid,
        "details" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_log" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_admin_audit_log_action" ON "admin_audit_log" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_admin_audit_log_created" ON "admin_audit_log" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_admin_audit_log_created"`);
    await queryRunner.query(`DROP INDEX "IDX_admin_audit_log_action"`);
    await queryRunner.query(`DROP TABLE "admin_audit_log"`);
    await queryRunner.query(`DROP INDEX "UQ_reports_open_per_reporter"`);
    await queryRunner.query(`DROP INDEX "IDX_reports_status_created"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(
      `ALTER TABLE "communities" DROP COLUMN "suspended_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "communities" DROP COLUMN "suspended_at"`,
    );
  }
}

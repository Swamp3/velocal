import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushNotifications1777700000000 implements MigrationInterface {
  name = 'AddPushNotifications1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" character varying(200) NOT NULL,
        "auth" character varying(100) NOT NULL,
        "user_agent" character varying(300),
        "failure_count" integer NOT NULL DEFAULT 0,
        "last_success_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_subscriptions_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "FK_push_subscriptions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_push_subscriptions_user" ON "push_subscriptions" ("user_id")`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "pushPreferences" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "pushPreferences"`,
    );
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventCommentShare1777100000000 implements MigrationInterface {
  name = 'AddEventCommentShare1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "event_comments" ADD "share_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "event_comments" ADD CONSTRAINT "FK_event_comments_share" FOREIGN KEY ("share_id") REFERENCES "event_shares"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_comments_share_id" ON "event_comments" ("share_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_event_comments_share_id"`);
    await queryRunner.query(
      `ALTER TABLE "event_comments" DROP CONSTRAINT "FK_event_comments_share"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_comments" DROP COLUMN "share_id"`,
    );
  }
}

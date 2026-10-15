import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBan1777500000000 implements MigrationInterface {
  name = 'AddUserBan1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "bannedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "banReason" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "banReason"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bannedAt"`);
  }
}

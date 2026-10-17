import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLastLogin1778300000000 implements MigrationInterface {
  name = 'AddUserLastLogin1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "lastLoginAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastLoginAt"`);
  }
}

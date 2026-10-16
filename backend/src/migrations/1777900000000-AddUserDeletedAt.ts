import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDeletedAt1777900000000 implements MigrationInterface {
  name = 'AddUserDeletedAt1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
  }
}

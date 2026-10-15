import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNames1777200000000 implements MigrationInterface {
  name = 'AddUserNames1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "firstName" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "lastName" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastName"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "firstName"`);
  }
}

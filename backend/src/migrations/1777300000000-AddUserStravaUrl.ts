import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserStravaUrl1777300000000 implements MigrationInterface {
  name = 'AddUserStravaUrl1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "stravaUrl" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "stravaUrl"`);
  }
}

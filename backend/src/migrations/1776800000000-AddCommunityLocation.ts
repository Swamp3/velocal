import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityLocation1776800000000 implements MigrationInterface {
  name = 'AddCommunityLocation1776800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "communities" ADD "location" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "communities" ADD "strava_url" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "communities" DROP COLUMN "strava_url"`,
    );
    await queryRunner.query(`ALTER TABLE "communities" DROP COLUMN "location"`);
  }
}

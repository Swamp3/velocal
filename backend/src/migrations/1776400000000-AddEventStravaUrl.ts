import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventStravaUrl1776400000000 implements MigrationInterface {
  name = 'AddEventStravaUrl1776400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "strava_url" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "strava_url"`);
  }
}

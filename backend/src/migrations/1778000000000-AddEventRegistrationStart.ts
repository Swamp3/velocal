import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventRegistrationStart1778000000000 implements MigrationInterface {
  name = 'AddEventRegistrationStart1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "registrationStart" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "registrationStart"`,
    );
  }
}

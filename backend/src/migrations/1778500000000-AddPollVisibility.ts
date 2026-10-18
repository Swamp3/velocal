import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPollVisibility1778500000000 implements MigrationInterface {
  name = 'AddPollVisibility1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "poll_visibility" AS ENUM('members', 'public')`,
    );
    await queryRunner.query(
      `ALTER TABLE "community_polls" ADD "visibility" "poll_visibility" NOT NULL DEFAULT 'members'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_polls" DROP COLUMN "visibility"`,
    );
    await queryRunner.query(`DROP TYPE "poll_visibility"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/** The timestamp now follows every verified request (throttled), not only sign-ins. */
export class RenameLastLoginToLastSeen1778400000000 implements MigrationInterface {
  name = 'RenameLastLoginToLastSeen1778400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "lastLoginAt" TO "lastSeenAt"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "lastSeenAt" TO "lastLoginAt"`,
    );
  }
}

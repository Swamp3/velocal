import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventCreatedBy1774800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE events ADD COLUMN created_by_id uuid REFERENCES users(id) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events DROP COLUMN created_by_id`);
  }
}

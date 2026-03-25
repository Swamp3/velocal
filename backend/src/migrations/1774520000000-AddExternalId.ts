import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExternalId1774520000000 implements MigrationInterface {
    name = 'AddExternalId1774520000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" ADD "externalId" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_events_externalId" ON "events" ("externalId") WHERE "externalId" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_events_externalId"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "externalId"`);
    }

}

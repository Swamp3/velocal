import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImportRuns1775300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "import_run_status_enum" AS ENUM('running', 'completed', 'failed')`,
    );

    await queryRunner.query(`
      CREATE TABLE "import_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source" character varying,
        "status" "import_run_status_enum" NOT NULL DEFAULT 'running',
        "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "finishedAt" TIMESTAMP WITH TIME ZONE,
        "eventsCreated" integer NOT NULL DEFAULT 0,
        "eventsUpdated" integer NOT NULL DEFAULT 0,
        "eventsSkipped" integer NOT NULL DEFAULT 0,
        "errorLog" text,
        CONSTRAINT "PK_import_runs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_import_runs_startedAt" ON "import_runs" ("startedAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "import_runs"`);
    await queryRunner.query(`DROP TYPE "import_run_status_enum"`);
  }
}

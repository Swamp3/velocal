import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityPolls1776100000000 implements MigrationInterface {
  name = 'AddCommunityPolls1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "poll_results_visibility" AS ENUM('members', 'managers')`,
    );
    await queryRunner.query(`
      CREATE TABLE "community_polls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "community_id" uuid NOT NULL,
        "subgroup_id" uuid,
        "author_id" uuid NOT NULL,
        "question" character varying NOT NULL,
        "multiple" boolean NOT NULL DEFAULT false,
        "resultsVisibility" "poll_results_visibility" NOT NULL DEFAULT 'members',
        "closesAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_polls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_polls_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_polls_subgroup" FOREIGN KEY ("subgroup_id") REFERENCES "subgroups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_polls_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "community_poll_options" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "poll_id" uuid NOT NULL,
        "label" character varying NOT NULL,
        "position" integer NOT NULL,
        CONSTRAINT "PK_community_poll_options" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_poll_options_poll" FOREIGN KEY ("poll_id") REFERENCES "community_polls"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "community_poll_votes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "option_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_community_poll_votes_option_user" UNIQUE ("option_id", "user_id"),
        CONSTRAINT "PK_community_poll_votes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_poll_votes_option" FOREIGN KEY ("option_id") REFERENCES "community_poll_options"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_poll_votes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_community_polls_community_id" ON "community_polls" ("community_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_community_polls_subgroup_id" ON "community_polls" ("subgroup_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "community_poll_votes"`);
    await queryRunner.query(`DROP TABLE "community_poll_options"`);
    await queryRunner.query(`DROP TABLE "community_polls"`);
    await queryRunner.query(`DROP TYPE "poll_results_visibility"`);
  }
}

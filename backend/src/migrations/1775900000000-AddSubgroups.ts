import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubgroups1775900000000 implements MigrationInterface {
  name = 'AddSubgroups1775900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "subgroup_visibility" AS ENUM('open', 'request', 'invite')`,
    );
    await queryRunner.query(
      `CREATE TYPE "subgroup_member_role" AS ENUM('member', 'moderator')`,
    );

    await queryRunner.query(`
      CREATE TABLE "subgroups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "community_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "description" text,
        "visibility" "subgroup_visibility" NOT NULL DEFAULT 'open',
        "heroUrl" character varying,
        "logoUrl" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subgroups_community_slug" UNIQUE ("community_id", "slug"),
        CONSTRAINT "PK_subgroups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subgroups_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "subgroup_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subgroup_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "subgroup_member_role" NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subgroup_members_subgroup_user" UNIQUE ("subgroup_id", "user_id"),
        CONSTRAINT "PK_subgroup_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subgroup_members_subgroup" FOREIGN KEY ("subgroup_id") REFERENCES "subgroups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_subgroup_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "subgroup_join_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subgroup_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "community_join_status" NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subgroup_join_requests_subgroup_user" UNIQUE ("subgroup_id", "user_id"),
        CONSTRAINT "PK_subgroup_join_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subgroup_join_requests_subgroup" FOREIGN KEY ("subgroup_id") REFERENCES "subgroups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_subgroup_join_requests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_subgroups_community_id" ON "subgroups" ("community_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subgroup_members_user_id" ON "subgroup_members" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_subgroup_members_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_subgroups_community_id"`);
    await queryRunner.query(`DROP TABLE "subgroup_join_requests"`);
    await queryRunner.query(`DROP TABLE "subgroup_members"`);
    await queryRunner.query(`DROP TABLE "subgroups"`);
    await queryRunner.query(`DROP TYPE "subgroup_member_role"`);
    await queryRunner.query(`DROP TYPE "subgroup_visibility"`);
  }
}

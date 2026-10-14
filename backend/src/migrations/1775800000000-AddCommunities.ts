import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunities1775800000000 implements MigrationInterface {
  name = 'AddCommunities1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "community_visibility" AS ENUM('public', 'request', 'private')`,
    );
    await queryRunner.query(
      `CREATE TYPE "community_member_role" AS ENUM('member', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "community_join_status" AS ENUM('pending', 'approved', 'rejected')`,
    );

    await queryRunner.query(`
      CREATE TABLE "communities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "description" text,
        "visibility" "community_visibility" NOT NULL DEFAULT 'public',
        "heroUrl" character varying,
        "logoUrl" character varying,
        "created_by_id" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_communities_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_communities" PRIMARY KEY ("id"),
        CONSTRAINT "FK_communities_user" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "community_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "community_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "community_member_role" NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_community_members_community_user" UNIQUE ("community_id", "user_id"),
        CONSTRAINT "PK_community_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_members_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "community_join_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "community_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "community_join_status" NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_community_join_requests_community_user" UNIQUE ("community_id", "user_id"),
        CONSTRAINT "PK_community_join_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_join_requests_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_join_requests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_community_members_user_id" ON "community_members" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_community_members_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "community_join_requests"`);
    await queryRunner.query(`DROP TABLE "community_members"`);
    await queryRunner.query(`DROP TABLE "communities"`);
    await queryRunner.query(`DROP TYPE "community_join_status"`);
    await queryRunner.query(`DROP TYPE "community_member_role"`);
    await queryRunner.query(`DROP TYPE "community_visibility"`);
  }
}

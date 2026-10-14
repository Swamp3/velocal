import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityPosts1776000000000 implements MigrationInterface {
  name = 'AddCommunityPosts1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "community_posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "community_id" uuid NOT NULL,
        "subgroup_id" uuid,
        "author_id" uuid NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_posts_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_posts_subgroup" FOREIGN KEY ("subgroup_id") REFERENCES "subgroups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_posts_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "community_post_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "body" text NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_post_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_post_comments_post" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_post_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_community_posts_community_id" ON "community_posts" ("community_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_community_posts_subgroup_id" ON "community_posts" ("subgroup_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_community_post_comments_post_id" ON "community_post_comments" ("post_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "community_post_comments"`);
    await queryRunner.query(`DROP TABLE "community_posts"`);
  }
}

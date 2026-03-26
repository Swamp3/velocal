import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPosts1774900000000 implements MigrationInterface {
  name = 'AddPosts1774900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "slug" character varying NOT NULL,
        "author_id" uuid NOT NULL,
        "event_id" uuid,
        "status" character varying NOT NULL DEFAULT 'published',
        "is_pinned" boolean NOT NULL DEFAULT false,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_posts_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_posts_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_posts_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "post_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "tag" character varying NOT NULL,
        CONSTRAINT "UQ_post_tags_post_tag" UNIQUE ("post_id", "tag"),
        CONSTRAINT "PK_post_tags" PRIMARY KEY ("id"),
        CONSTRAINT "FK_post_tags_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_posts_slug" ON "posts" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_posts_author" ON "posts" ("author_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_posts_event" ON "posts" ("event_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_posts_status_published" ON "posts" ("status", "publishedAt" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_post_tags_tag" ON "post_tags" ("tag")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_tags_tag"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_status_published"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_event"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_author"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_posts_slug"`);
    await queryRunner.query(`DROP TABLE "post_tags"`);
    await queryRunner.query(`DROP TABLE "posts"`);
  }
}

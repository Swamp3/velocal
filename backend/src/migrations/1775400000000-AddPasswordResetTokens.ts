import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetTokens1775400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "usedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prt_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_prt_userId" ON "password_reset_tokens" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_prt_tokenHash" ON "password_reset_tokens" ("tokenHash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_prt_tokenHash"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_prt_userId"`);
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
  }
}

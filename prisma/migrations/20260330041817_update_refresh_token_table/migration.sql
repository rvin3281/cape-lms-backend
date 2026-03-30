/*
  Warnings:

  - A unique constraint covering the columns `[refresh_token_id]` on the table `cape_refresh_tokens` will be added. If there are existing duplicate values, this will fail.
  - The required column `refresh_token_id` was added to the `cape_refresh_tokens` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[cape_refresh_tokens] ADD [auth_scope] NVARCHAR(50),
[refresh_token_id] NVARCHAR(1000) NOT NULL,
[selected_role_code] NVARCHAR(50),
[selected_role_id] NVARCHAR(50);

-- CreateIndex
ALTER TABLE [dbo].[cape_refresh_tokens] ADD CONSTRAINT [cape_refresh_tokens_refresh_token_id_key] UNIQUE NONCLUSTERED ([refresh_token_id]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

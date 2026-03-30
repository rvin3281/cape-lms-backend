/*
  Warnings:

  - You are about to drop the column `role_id` on the `cape_users` table. All the data in the column will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[cape_users] DROP CONSTRAINT [cape_users_role_id_fkey];

-- DropIndex
DROP INDEX [cape_users_role_id_idx] ON [dbo].[cape_users];

-- AlterTable
ALTER TABLE [dbo].[cape_users] DROP COLUMN [role_id];

-- CreateTable
CREATE TABLE [dbo].[cape_user_roles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_role_id] NVARCHAR(100) NOT NULL,
    [user_id] NVARCHAR(100) NOT NULL,
    [role_id] NVARCHAR(50) NOT NULL,
    [assigned_at] DATETIME2 NOT NULL CONSTRAINT [cape_user_roles_assigned_at_df] DEFAULT CURRENT_TIMESTAMP,
    [assigned_by] NVARCHAR(100),
    CONSTRAINT [cape_user_roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [cape_user_roles_user_role_id_key] UNIQUE NONCLUSTERED ([user_role_id]),
    CONSTRAINT [cape_user_roles_user_id_role_id_key] UNIQUE NONCLUSTERED ([user_id],[role_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cape_user_roles_user_id_idx] ON [dbo].[cape_user_roles]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cape_user_roles_role_id_idx] ON [dbo].[cape_user_roles]([role_id]);

-- AddForeignKey
ALTER TABLE [dbo].[cape_user_roles] ADD CONSTRAINT [cape_user_roles_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[cape_users]([user_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[cape_user_roles] ADD CONSTRAINT [cape_user_roles_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[cape_roles]([role_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

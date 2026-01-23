BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[cape_users] DROP CONSTRAINT [cape_users_is_first_time_login_df];
ALTER TABLE [dbo].[cape_users] ADD CONSTRAINT [cape_users_is_first_time_login_df] DEFAULT 1 FOR [is_first_time_login];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

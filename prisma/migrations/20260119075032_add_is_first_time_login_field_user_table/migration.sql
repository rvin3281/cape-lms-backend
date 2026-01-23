BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[cape_users] ADD [is_first_time_login] BIT NOT NULL CONSTRAINT [cape_users_is_first_time_login_df] DEFAULT 0;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

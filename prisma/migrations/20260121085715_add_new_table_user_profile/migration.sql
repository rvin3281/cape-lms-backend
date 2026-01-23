BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[cape_user_profiles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] NVARCHAR(100) NOT NULL,
    [phone_number] NVARCHAR(150) NOT NULL,
    [job_title] NVARCHAR(150) NOT NULL,
    [current_title] NVARCHAR(150) NOT NULL,
    [target_title] NVARCHAR(150) NOT NULL,
    [industry] NVARCHAR(150) NOT NULL,
    [career_goals] NVARCHAR(max) NOT NULL,
    [skills_json] NVARCHAR(max) NOT NULL,
    CONSTRAINT [cape_user_profiles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [cape_user_profiles_user_id_key] UNIQUE NONCLUSTERED ([user_id])
);

-- AddForeignKey
ALTER TABLE [dbo].[cape_user_profiles] ADD CONSTRAINT [cape_user_profiles_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[cape_users]([user_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

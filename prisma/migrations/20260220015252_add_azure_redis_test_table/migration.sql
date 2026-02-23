BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[AzureRedisTestRecord] (
    [id] NVARCHAR(1000) NOT NULL,
    [externalId] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000),
    [fullName] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [AzureRedisTestRecord_status_df] DEFAULT 'pending',
    [attempts] INT NOT NULL CONSTRAINT [AzureRedisTestRecord_attempts_df] DEFAULT 0,
    [lastMessage] NVARCHAR(1000),
    [payload] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AzureRedisTestRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AzureRedisTestRecord_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AzureRedisTestRecord_externalId_key] UNIQUE NONCLUSTERED ([externalId])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

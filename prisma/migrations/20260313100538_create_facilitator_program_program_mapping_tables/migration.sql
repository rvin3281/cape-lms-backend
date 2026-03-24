BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[facilitator] (
    [id] INT NOT NULL IDENTITY(1,1),
    [facilitator_id] NVARCHAR(100) NOT NULL,
    [facilitator_name] NVARCHAR(255) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [facilitator_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [created_by] NVARCHAR(100),
    [updated_by] NVARCHAR(100),
    [deleted_at] DATETIME2,
    [deleted_by] NVARCHAR(100),
    CONSTRAINT [facilitator_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [facilitator_facilitator_id_key] UNIQUE NONCLUSTERED ([facilitator_id])
);

-- CreateTable
CREATE TABLE [dbo].[cape_program] (
    [id] INT NOT NULL IDENTITY(1,1),
    [program_id] NVARCHAR(100) NOT NULL,
    [program_name] NVARCHAR(255) NOT NULL,
    [program_date] DATE NOT NULL,
    [program_cohort] NVARCHAR(100) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [cape_program_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [created_by] NVARCHAR(100),
    [updated_by] NVARCHAR(100),
    [deleted_at] DATETIME2,
    [deleted_by] NVARCHAR(100),
    CONSTRAINT [cape_program_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [cape_program_program_id_key] UNIQUE NONCLUSTERED ([program_id])
);

-- CreateTable
CREATE TABLE [dbo].[program_facilitator] (
    [id] INT NOT NULL IDENTITY(1,1),
    [program_id] NVARCHAR(100) NOT NULL,
    [facilitator_id] NVARCHAR(100) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [program_facilitator_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [program_facilitator_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [program_facilitator_program_id_facilitator_id_key] UNIQUE NONCLUSTERED ([program_id],[facilitator_id])
);

-- CreateTable
CREATE TABLE [dbo].[program_cape_user_enrollment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [enrollment_id] NVARCHAR(100) NOT NULL,
    [program_id] NVARCHAR(100) NOT NULL,
    [user_id] NVARCHAR(100) NOT NULL,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [program_cape_user_enrollment_status_df] DEFAULT 'ACTIVE',
    [is_review_feedback_completed] BIT NOT NULL CONSTRAINT [program_cape_user_enrollment_is_review_feedback_completed_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [program_cape_user_enrollment_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [created_by] NVARCHAR(100),
    [updated_by] NVARCHAR(100),
    [deleted_at] DATETIME2,
    [deleted_by] NVARCHAR(100),
    CONSTRAINT [program_cape_user_enrollment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [program_cape_user_enrollment_enrollment_id_key] UNIQUE NONCLUSTERED ([enrollment_id]),
    CONSTRAINT [program_cape_user_enrollment_program_id_user_id_key] UNIQUE NONCLUSTERED ([program_id],[user_id])
);

-- CreateTable
CREATE TABLE [dbo].[program_cape_user_facilitator] (
    [id] INT NOT NULL IDENTITY(1,1),
    [assignment_id] NVARCHAR(100) NOT NULL,
    [program_id] NVARCHAR(100) NOT NULL,
    [facilitator_id] NVARCHAR(100) NOT NULL,
    [user_id] NVARCHAR(100) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [program_cape_user_facilitator_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [created_by] NVARCHAR(100),
    [updated_by] NVARCHAR(100),
    [deleted_at] DATETIME2,
    [deleted_by] NVARCHAR(100),
    CONSTRAINT [program_cape_user_facilitator_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [program_cape_user_facilitator_assignment_id_key] UNIQUE NONCLUSTERED ([assignment_id]),
    CONSTRAINT [program_cape_user_facilitator_program_id_facilitator_id_user_id_key] UNIQUE NONCLUSTERED ([program_id],[facilitator_id],[user_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [program_cape_user_enrollment_program_id_idx] ON [dbo].[program_cape_user_enrollment]([program_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [program_cape_user_enrollment_user_id_idx] ON [dbo].[program_cape_user_enrollment]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [program_cape_user_enrollment_status_idx] ON [dbo].[program_cape_user_enrollment]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [program_cape_user_facilitator_program_id_idx] ON [dbo].[program_cape_user_facilitator]([program_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [program_cape_user_facilitator_facilitator_id_idx] ON [dbo].[program_cape_user_facilitator]([facilitator_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [program_cape_user_facilitator_user_id_idx] ON [dbo].[program_cape_user_facilitator]([user_id]);

-- AddForeignKey
ALTER TABLE [dbo].[program_facilitator] ADD CONSTRAINT [program_facilitator_program_id_fkey] FOREIGN KEY ([program_id]) REFERENCES [dbo].[cape_program]([program_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[program_facilitator] ADD CONSTRAINT [program_facilitator_facilitator_id_fkey] FOREIGN KEY ([facilitator_id]) REFERENCES [dbo].[facilitator]([facilitator_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[program_cape_user_enrollment] ADD CONSTRAINT [program_cape_user_enrollment_program_id_fkey] FOREIGN KEY ([program_id]) REFERENCES [dbo].[cape_program]([program_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[program_cape_user_enrollment] ADD CONSTRAINT [program_cape_user_enrollment_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[cape_users]([user_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[program_cape_user_facilitator] ADD CONSTRAINT [program_cape_user_facilitator_program_id_fkey] FOREIGN KEY ([program_id]) REFERENCES [dbo].[cape_program]([program_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[program_cape_user_facilitator] ADD CONSTRAINT [program_cape_user_facilitator_facilitator_id_fkey] FOREIGN KEY ([facilitator_id]) REFERENCES [dbo].[facilitator]([facilitator_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[program_cape_user_facilitator] ADD CONSTRAINT [program_cape_user_facilitator_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[cape_users]([user_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

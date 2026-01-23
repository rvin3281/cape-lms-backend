BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[cape_roles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [role_id] NVARCHAR(50) NOT NULL,
    [role_name] NVARCHAR(100) NOT NULL,
    [role_code] NVARCHAR(50) NOT NULL,
    [level] NVARCHAR(50) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [cape_roles_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [created_by] NVARCHAR(100),
    CONSTRAINT [cape_roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [cape_roles_role_id_key] UNIQUE NONCLUSTERED ([role_id]),
    CONSTRAINT [cape_roles_role_name_key] UNIQUE NONCLUSTERED ([role_name]),
    CONSTRAINT [cape_roles_role_code_key] UNIQUE NONCLUSTERED ([role_code]),
    CONSTRAINT [cape_roles_level_key] UNIQUE NONCLUSTERED ([level])
);

-- CreateTable
CREATE TABLE [dbo].[cape_users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] NVARCHAR(100) NOT NULL,
    [learnworld_id] VARCHAR(255),
    [email] NVARCHAR(255) NOT NULL,
    [password_hash] NVARCHAR(255) NOT NULL,
    [first_name] NVARCHAR(200) NOT NULL,
    [last_name] NVARCHAR(200) NOT NULL,
    [user_name] NVARCHAR(150) NOT NULL,
    [role_id] NVARCHAR(50) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [cape_users_is_active_df] DEFAULT 1,
    [is_admin] BIT NOT NULL CONSTRAINT [cape_users_is_admin_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [cape_users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [created_by] NVARCHAR(100),
    [updated_by] NVARCHAR(100),
    [deleted_at] DATETIME2,
    [deleted_by] NVARCHAR(100),
    CONSTRAINT [cape_users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [cape_users_user_id_key] UNIQUE NONCLUSTERED ([user_id]),
    CONSTRAINT [cape_users_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [cape_users_user_name_key] UNIQUE NONCLUSTERED ([user_name])
);

-- CreateTable
CREATE TABLE [dbo].[cape_learner_profiles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] NVARCHAR(100) NOT NULL,
    [bio] NVARCHAR(1000),
    [location] NVARCHAR(255),
    [url] NVARCHAR(500),
    [fb] NVARCHAR(255),
    [twitter] NVARCHAR(255),
    [instagram] NVARCHAR(255),
    [linkedin] NVARCHAR(255),
    [skype] NVARCHAR(255),
    [behance] NVARCHAR(255),
    [dribbble] NVARCHAR(255),
    [github] NVARCHAR(255),
    [cf_company] NVARCHAR(255),
    [cf_cohort] NVARCHAR(255),
    [nps_score] INT,
    [nps_comment] NVARCHAR(1000),
    [tags] NVARCHAR(255),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [cape_learner_profiles_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [cape_learner_profiles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [cape_learner_profiles_user_id_key] UNIQUE NONCLUSTERED ([user_id])
);

-- CreateTable
CREATE TABLE [dbo].[cape_refresh_tokens] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(100) NOT NULL,
    [token_hash] VARCHAR(255) NOT NULL,
    [user_agent] TEXT,
    [ip_address] TEXT,
    [is_revoked] BIT NOT NULL CONSTRAINT [cape_refresh_tokens_is_revoked_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [cape_refresh_tokens_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [expires_at] DATETIME2 NOT NULL,
    CONSTRAINT [cape_refresh_tokens_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[cape_password_setup_token] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(255) NOT NULL,
    [token_hash] NVARCHAR(100) NOT NULL,
    [used_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [cape_password_setup_token_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [cape_password_setup_token_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [cape_password_setup_token_token_hash_key] UNIQUE NONCLUSTERED ([token_hash])
);

-- CreateTable
CREATE TABLE [dbo].[learnworlds_programs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [product_id] NVARCHAR(128),
    [product_title] NVARCHAR(255),
    [product_type] NVARCHAR(50),
    [product_currency] NVARCHAR(10),
    [product_description] NVARCHAR(2000),
    [product_price] INT,
    [product_url] NVARCHAR(500),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [learnworlds_programs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [learnworlds_programs_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [learnworlds_programs_product_id_key] UNIQUE NONCLUSTERED ([product_id])
);

-- CreateTable
CREATE TABLE [dbo].[learnworlds_user_enrollment_program] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] NVARCHAR(100) NOT NULL,
    [product_id] NVARCHAR(128) NOT NULL,
    [enrolled_at] DATETIME2 CONSTRAINT [learnworlds_user_enrollment_program_enrolled_at_df] DEFAULT CURRENT_TIMESTAMP,
    [status] NVARCHAR(50),
    [progress] INT,
    CONSTRAINT [learnworlds_user_enrollment_program_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [learnworlds_user_enrollment_program_user_id_product_id_key] UNIQUE NONCLUSTERED ([user_id],[product_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cape_users_role_id_idx] ON [dbo].[cape_users]([role_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [cape_password_setup_token_email_idx] ON [dbo].[cape_password_setup_token]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [learnworlds_programs_product_id_idx] ON [dbo].[learnworlds_programs]([product_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [learnworlds_user_enrollment_program_user_id_idx] ON [dbo].[learnworlds_user_enrollment_program]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [learnworlds_user_enrollment_program_product_id_idx] ON [dbo].[learnworlds_user_enrollment_program]([product_id]);

-- AddForeignKey
ALTER TABLE [dbo].[cape_users] ADD CONSTRAINT [cape_users_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[cape_roles]([role_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[cape_learner_profiles] ADD CONSTRAINT [cape_learner_profiles_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[cape_users]([user_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[cape_refresh_tokens] ADD CONSTRAINT [cape_refresh_tokens_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[cape_users]([user_id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[learnworlds_user_enrollment_program] ADD CONSTRAINT [learnworlds_user_enrollment_program_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[cape_users]([user_id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[learnworlds_user_enrollment_program] ADD CONSTRAINT [learnworlds_user_enrollment_program_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[learnworlds_programs]([product_id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

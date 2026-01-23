/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
export interface LearnWorldsUser {
  id: string;
  email: string;
  username: string;

  first_name?: string;
  last_name?: string;

  subscribed_for_marketing_emails?: boolean | null;
  eu_customer?: boolean | null;

  is_admin: boolean;
  is_instructor: boolean;
  is_suspended: boolean;
  is_reporter: boolean;
  is_affiliate?: boolean;

  role: LearnWorldsRole;

  referrer_id?: string | null;

  created: number; // unix timestamp (seconds)
  last_login?: number | null;

  signup_approval_status?: string | null;
  email_verification_status?: 'skipped_verification' | 'verified' | 'pending';

  fields?: LearnWorldsUserFields;
  tags?: string[];
  utms?: LearnWorldsUTMs;

  billing_info?: unknown | null;

  nps_score?: number | null;
  nps_comment?: string | null;
}

export interface LearnWorldsRole {
  level: 'user' | 'admin' | 'instructor';
  name: string;
}

export interface LearnWorldsUserFields {
  bio?: string | null;
  location?: string | null;
  url?: string | null;

  fb?: string | null;
  twitter?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  skype?: string | null;

  behance?: string | null;
  dribbble?: string | null;
  github?: string | null;

  cf_company?: string | null;
  cf_cohort?: string | null;
}

export interface LearnWorldsUTMs {
  fc_utm_source?: string | null;
  fc_utm_medium?: string | null;
  fc_utm_campaign?: string | null;
  fc_utm_term?: string | null;
  fc_utm_content?: string | null;
  fc_landing?: string | null;
  fc_referrer?: string | null;
  fc_country?: string | null;

  lc_utm_source?: string | null;
  lc_utm_medium?: string | null;
  lc_utm_campaign?: string | null;
  lc_utm_term?: string | null;
  lc_utm_content?: string | null;
  lc_landing?: string | null;
  lc_referrer?: string | null;
  lc_country?: string | null;
}

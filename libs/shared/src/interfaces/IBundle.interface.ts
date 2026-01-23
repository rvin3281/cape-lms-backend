export interface BundlesResponse {
  data: Bundle[];
  meta: PaginationMeta;
}

export interface IBundlesById {
  data: Bundle;
}

export interface Bundle {
  id: string;
  title: string;
  products: BundleProducts;
  image?: string | null;
  description: string | null;
  access: 'private' | 'public';
  created: number; // unix timestamp (seconds with decimals)
  modified: number; // unix timestamp (seconds with decimals)
  afterPurchase?: AfterPurchase;
  price?: number;
  paymentPlans?: PaymentPlan[];
}

export interface BundleProducts {
  courses: string[]; // course slugs / IDs
}

export interface AfterPurchase {
  type: 'afterlogin' | 'url' | 'page';
  settings: {
    url: string | null;
    page: string | null;
  };
}

export interface PaymentPlan {
  id: string;
  name: string;
  description: string | null;
  type: 'without_upfront' | 'with_upfront';
  order: number;

  firstAmount: number;
  amount: number;
  paymentsCount: number;

  subscriptionTrialType: 'default' | 'custom';
  subscriptionIntervalType: '1-month' | '3-month' | '6-month' | '1-year';

  status: 'public' | 'private';
  isCancelable: boolean;

  validFrom: number | null;
  validTo: number | null;

  subscriptionTrialDays: number | null;
  subscriptionTrialDate: number | null;

  nameOverride: boolean;
  paymentPlanNameOverride: string | null;
}

export interface PaginationMeta {
  page: number;
  totalItems: number;
  totalPages: number;
  itemsPerPage: number;
}

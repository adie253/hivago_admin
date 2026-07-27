import apiClient, { API_URL } from './axios';
import { useAuthStore } from '@/store/authStore';

export type PayoutStatus = 'Pending' | 'Processing' | 'Paid' | 'Failed' | 'OnHold';

export interface ExcludedPayout {
  payoutId: string;
  ownerId?: string;   // restaurant export
  riderId?: string;   // rider export
  netPayoutAmount?: number;
  netPayable?: number;
  reason: string;
}

export interface ExportMeta {
  exportBatchId: string;
  rowCount: number;
  controlSumTotal: number;
  excluded: ExcludedPayout[];
}

export class ExportError extends Error {
  status: number;
  isNotFound: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ExportError';
    this.status = status;
    this.isNotFound = status === 404;
  }
}

async function executePayoutExport(url: string, defaultFilename: string): Promise<ExportMeta> {
  const token = useAuthStore.getState().token;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token || ''}`,
    },
  });

  if (!res.ok) {
    let errorMessage = 'Export failed';
    try {
      const body = await res.json();
      errorMessage = body.message || errorMessage;
    } catch {
      if (res.status === 404) {
        errorMessage = 'Nothing to export for this week';
      }
    }
    if (res.status === 404 && errorMessage === 'Export failed') {
      errorMessage = 'Nothing to export for this week';
    }
    throw new ExportError(errorMessage, res.status);
  }

  const rawMetaHeader = res.headers.get('X-Payout-Export-Meta') ?? '{}';
  let meta: ExportMeta = {
    exportBatchId: '',
    rowCount: 0,
    controlSumTotal: 0,
    excluded: [],
  };

  try {
    meta = JSON.parse(rawMetaHeader);
  } catch (e) {
    console.error('Failed to parse X-Payout-Export-Meta header:', e);
  }

  // Trigger browser file download
  const blob = await res.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;

  const disposition = res.headers.get('Content-Disposition');
  let filename = defaultFilename;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(downloadUrl);

  return meta;
}

export interface PayoutSummary {
  pendingCount: number;
  totalPendingAmount: number;
  failedAmount: number;
  onHoldCount: number;
  onHoldAmount: number;
  platformProfit: number;
  nextAutoRunAtUtc: string;
  lastAutoRun: {
    atUtc: string;
    restaurantCount: number;
    totalAmount: number;
    totalPaid: number;
  } | null;
}

export interface RestaurantPayoutItem {
  payoutId: string;
  ownerId: string;
  displayName: string;
  orderCount: number;
  gmv: number;
  netPayable: number;
  status: PayoutStatus;
  statusNote: string | null;
  cycleStart: string;
  cycleEnd: string;
  createdAtUtc: string;
  paidAtUtc: string | null;
  transactionReference: string | null;
}

export interface RestaurantPayoutsPagedResult {
  items: RestaurantPayoutItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PayoutFilter {
  from?: string;
  to?: string;
  ownerId?: string;
  status?: PayoutStatus | '';
  page?: number;
  pageSize?: number;
}

export interface RiderPayoutItem {
  payoutId: string;
  riderId: string;
  displayName: string;
  deliveryCount: number;
  earnings: number;
  incentives: number;
  finalPayout: number;
  status: PayoutStatus;
  statusNote: string | null;
  cycleStart: string;
  cycleEnd: string;
  createdAtUtc: string;
  paidAtUtc: string | null;
  transactionReference: string | null;
}

export interface RiderPayoutsPagedResult {
  items: RiderPayoutItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface RiderPayoutSummary {
  pendingCount: number;
  totalPendingAmount: number;
  failedAmount: number;
  onHoldCount: number;
  onHoldAmount: number;
  subsidyImpact?: number;
  totalEarnings?: number;
  nextAutoRunAtUtc: string;
  lastAutoRun: {
    atUtc: string;
    riderCount: number;
    totalAmount: number;
    totalPaid: number;
  } | null;
}

export const payoutService = {
  getRestaurantPayoutSummary: async (): Promise<PayoutSummary> => {
    const response = await apiClient.get('/admin/payouts/restaurant/summary');
    return response as any;
  },

  getRestaurantPayouts: async (params: PayoutFilter = {}): Promise<RestaurantPayoutsPagedResult> => {
    const response = await apiClient.get('/admin/payouts/restaurant', { params });
    return response as any;
  },

  payNow: async (payoutId: string): Promise<{ transactionReference: string; status: PayoutStatus }> => {
    const response = await apiClient.post(`/admin/payouts/restaurant/${payoutId}/pay-now`);
    return response as any;
  },

  holdPayout: async (payoutId: string, reason?: string): Promise<void> => {
    await apiClient.post(`/admin/payouts/restaurant/${payoutId}/hold`, { reason });
  },

  releaseHold: async (payoutId: string): Promise<void> => {
    await apiClient.post(`/admin/payouts/restaurant/${payoutId}/release-hold`);
  },

  retryPayout: async (payoutId: string): Promise<void> => {
    await apiClient.post(`/admin/payouts/restaurant/${payoutId}/retry`);
  },

  getRiderPayoutSummary: async (): Promise<RiderPayoutSummary> => {
    const response = await apiClient.get('/admin/payouts/rider/summary');
    return response as any;
  },

  getRiderPayouts: async (params: PayoutFilter = {}): Promise<RiderPayoutsPagedResult> => {
    const response = await apiClient.get('/admin/payouts/rider', { params });
    return response as any;
  },

  payRiderNow: async (payoutId: string): Promise<{ transactionReference: string; status: PayoutStatus }> => {
    const response = await apiClient.post(`/admin/payouts/rider/${payoutId}/pay-now`);
    return response as any;
  },

  holdRiderPayout: async (payoutId: string, reason?: string): Promise<void> => {
    await apiClient.post(`/admin/payouts/rider/${payoutId}/hold`, { reason });
  },

  releaseRiderHold: async (payoutId: string): Promise<void> => {
    await apiClient.post(`/admin/payouts/rider/${payoutId}/release-hold`);
  },

  retryRiderPayout: async (payoutId: string): Promise<void> => {
    await apiClient.post(`/admin/payouts/rider/${payoutId}/retry`);
  },

  exportRestaurantPayouts: async (periodStart: string, periodEnd: string): Promise<ExportMeta> => {
    const baseUrl = API_URL ? (API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL) : '';
    const url = `${baseUrl}/admin/payouts/restaurant/export?periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEnd)}`;
    return executePayoutExport(url, `restaurant-payouts-${periodStart}-${periodEnd}.xlsx`);
  },

  exportRiderPayouts: async (cycleStartUtc: string, cycleEndUtc: string): Promise<ExportMeta> => {
    const baseUrl = API_URL ? (API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL) : '';
    const url = `${baseUrl}/admin/payouts/rider/export?cycleStartUtc=${encodeURIComponent(cycleStartUtc)}&cycleEndUtc=${encodeURIComponent(cycleEndUtc)}`;
    const cleanStart = cycleStartUtc.split('T')[0];
    const cleanEnd = cycleEndUtc.split('T')[0];
    return executePayoutExport(url, `rider-payouts-${cleanStart}-${cleanEnd}.xlsx`);
  },
};


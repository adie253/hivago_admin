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

export interface UnresolvedItem {
  rowNumber: number;
  beneficiaryName: string;
  accountNumber: string;
  amount: number;
  reason: string;
}

export interface ReconcileResult {
  exportBatchId: string;
  rowsInFile: number;
  markedPaid: number;
  markedFailed: number;
  alreadyResolvedSkipped: number;
  unresolved: UnresolvedItem[];
  batchFullyReconciled: boolean;
}

export interface BatchSummary {
  id: string;
  periodStart: string;       // date, e.g. "2026-07-27"
  periodEnd: string;
  rowCount: number;
  controlSumTotal: number;
  status: 'Generated' | 'Reconciled';
  generatedByAdminId: string;
  generatedAtUtc: string;
  reconciledByAdminId: string | null;
  reconciledAtUtc: string | null;
  processingCount: number;   // still awaiting reconcile
  paidCount: number;
  failedCount: number;
}

export interface BatchSummaryPagedResult {
  items: BatchSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface StaleRestaurantPayout {
  payoutId: string;
  ownerId: string;
  netPayoutAmount: number;
  exportBatchId: string | null;
  exportedAtUtc: string | null;
  daysStale: number;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
}

export interface StaleRiderPayout {
  payoutId: string;
  riderId: string;
  netPayable: number;
  exportBatchId: string | null;
  exportedAtUtc: string | null;
  daysStale: number;
}

export interface ManualResolveRequest {
  outcome: 'Paid' | 'Failed';
  transactionReference?: string;  // REQUIRED if outcome is 'Paid', omit/ignore if 'Failed'
  reason: string;                 // REQUIRED always, min 10 chars
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

export function extractErrorMessage(err: any, fallback: string = 'An error occurred'): string {
  const data = err?.response?.data || err?.data || err;
  if (data) {
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error;
    }
  }
  return err?.message || fallback;
}

export function isSuperAdmin(): boolean {
  const { token, user } = useAuthStore.getState();
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const role = payload.role || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.Role;
        if (role) {
          return String(role).toLowerCase() === 'superadmin';
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }
  return user?.role?.toLowerCase() === 'superadmin';
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
      errorMessage = extractErrorMessage(body, errorMessage);
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

export interface RestaurantPayoutLedgerEntry {
  id: string;
  outletId: string;
  orderId: string;
  orderNumber: string;
  orderAmount: number;
  gstAmount: number;
  commissionPercentage: number;
  commissionFlatFee: number;
  commissionAmount: number;
  commissionGst: number;
  tdsAmount: number;
  netAmount: number;
  status: string;
  createdAtUtc: string;
}

export interface RestaurantPayoutBreakdown {
  payoutId: string;
  ownerId: string;
  displayName: string;
  cycleStart: string;
  cycleEnd: string;
  orderCount: number;
  grossOrderAmount: number;
  totalGstCollected: number;
  totalCommission: number;
  totalCommissionGst: number;
  totalTds: number;
  netPayoutAmount: number;
  status: PayoutStatus;
  transactionReference: string | null;
  paidAtUtc: string | null;
  notes: string | null;
  createdAtUtc: string;
  ledgerEntries: RestaurantPayoutLedgerEntry[];
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

  getRestaurantPayoutBreakdown: async (payoutId: string): Promise<RestaurantPayoutBreakdown> => {
    const response = await apiClient.get(`/admin/payouts/restaurant/${payoutId}`);
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

  // Step 1: Reconcile ICICI Response Upload
  reconcileRestaurantPayouts: async (batchId: string, file: File): Promise<ReconcileResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/admin/payouts/restaurant/reconcile?batchId=${encodeURIComponent(batchId)}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response as any;
  },

  reconcileRiderPayouts: async (batchId: string, file: File): Promise<ReconcileResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/admin/payouts/rider/reconcile?batchId=${encodeURIComponent(batchId)}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response as any;
  },

  // Step 2: Batch List
  getRestaurantBatches: async (params: { status?: string; page?: number; pageSize?: number } = {}): Promise<BatchSummaryPagedResult | BatchSummary[]> => {
    const response = await apiClient.get('/admin/payouts/restaurant/batches', { params });
    return response as any;
  },

  getRiderBatches: async (params: { status?: string; page?: number; pageSize?: number } = {}): Promise<BatchSummaryPagedResult | BatchSummary[]> => {
    const response = await apiClient.get('/admin/payouts/rider/batches', { params });
    return response as any;
  },

  // Step 3: Stale Report
  getStaleRestaurantPayouts: async (olderThanDays: number = 3): Promise<StaleRestaurantPayout[]> => {
    const response = await apiClient.get(`/admin/payouts/restaurant/stale?olderThanDays=${olderThanDays}`);
    return response as any;
  },

  getStaleRiderPayouts: async (olderThanDays: number = 3): Promise<StaleRiderPayout[]> => {
    const response = await apiClient.get(`/admin/payouts/rider/stale?olderThanDays=${olderThanDays}`);
    return response as any;
  },

  // Step 4: Manual Resolve
  manualResolveRestaurantPayout: async (payoutId: string, data: ManualResolveRequest): Promise<void> => {
    await apiClient.post(`/admin/payouts/restaurant/${payoutId}/manual-resolve`, data);
  },

  manualResolveRiderPayout: async (payoutId: string, data: ManualResolveRequest): Promise<void> => {
    await apiClient.post(`/admin/payouts/rider/${payoutId}/manual-resolve`, data);
  },
};

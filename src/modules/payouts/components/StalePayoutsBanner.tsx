import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Clock, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { 
  payoutService, 
  isSuperAdmin,
  type StaleRestaurantPayout, 
  type StaleRiderPayout 
} from '@/core/api/payouts';
import ManualResolveModal from './ManualResolveModal';

interface StalePayoutsBannerProps {
  activeTab: 'restaurant' | 'rider';
  onSelectBatchId?: (batchId: string) => void;
}

export default function StalePayoutsBanner({ activeTab, onSelectBatchId }: StalePayoutsBannerProps) {
  // Banner always tracks payouts older than 3 days for the main page alert
  const bannerThresholdDays = 3;
  const [modalFilterDays, setModalFilterDays] = useState<number>(3);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manualResolveTarget, setManualResolveTarget] = useState<string | null>(null);

  // 1. Fetch main page alert banner data (always 3+ days)
  const { data: bannerStaleData, refetch: refetchBanner } = useQuery({
    queryKey: ['stalePayoutsBanner', activeTab, bannerThresholdDays],
    queryFn: async () => {
      if (activeTab === 'restaurant') {
        return await payoutService.getStaleRestaurantPayouts(bannerThresholdDays);
      } else {
        return await payoutService.getStaleRiderPayouts(bannerThresholdDays);
      }
    },
  });

  // 2. Fetch modal drawer data (filtered by modalFilterDays: 3, 7, or 14 days)
  const { data: modalStaleData, refetch: refetchModal, isLoading: isLoadingModal } = useQuery({
    queryKey: ['stalePayoutsModal', activeTab, modalFilterDays],
    queryFn: async () => {
      if (activeTab === 'restaurant') {
        return await payoutService.getStaleRestaurantPayouts(modalFilterDays);
      } else {
        return await payoutService.getStaleRiderPayouts(modalFilterDays);
      }
    },
    enabled: isModalOpen,
  });

  const bannerItems = (bannerStaleData || []) as (StaleRestaurantPayout | StaleRiderPayout)[];
  const bannerCount = bannerItems.length;
  const showBanner = bannerCount > 0;

  const modalItems = (modalStaleData || []) as (StaleRestaurantPayout | StaleRiderPayout)[];

  const handleManualResolveSuccess = () => {
    refetchBanner();
    refetchModal();
  };

  // Don't render anything if there are no stale items for the banner AND modal is closed
  if (!showBanner && !isModalOpen && !manualResolveTarget) {
    return null;
  }

  return (
    <>
      {/* Main Page Warning Banner (Always persistent based on 3+ days threshold) */}
      {showBanner && (
        <div className="mb-6 bg-amber-50 border border-amber-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Stale Payouts Alert
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                  {bannerCount} Payouts Stuck
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                {bannerCount} {activeTab} payout{bannerCount > 1 ? 's are' : ' is'} stuck in Processing status for over {bannerThresholdDays} days without bank reconciliation.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => {
              setModalFilterDays(3);
              setIsModalOpen(true);
            }}
            className="h-9 px-4 rounded-xl font-bold text-xs bg-amber-700 hover:bg-amber-800 text-white shadow-sm flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <span>Review Stale Payouts</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Stale Payouts Detailed Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Stale {activeTab === 'restaurant' ? 'Restaurant' : 'Rider'} Payouts Report
                  </h3>
                  <p className="text-xs text-gray-500">
                    Payouts stuck in Processing phase awaiting bank reconciliation
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Days Filter Buttons (3, 7, 14 days) */}
                <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
                  <span className="text-[11px] font-semibold text-gray-500 pl-2">Stuck &gt;</span>
                  {[3, 7, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setModalFilterDays(days)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        modalFilterDays === days
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-y-auto flex-1 my-4 border border-gray-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Payout ID</th>
                    <th className="py-3 px-4">{activeTab === 'restaurant' ? 'Owner ID' : 'Rider ID'}</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Days Stuck</th>
                    <th className="py-3 px-4">Export Batch ID</th>
                    {activeTab === 'restaurant' && <th className="py-3 px-4">Bank Details</th>}
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {isLoadingModal ? (
                    <tr>
                      <td colSpan={activeTab === 'restaurant' ? 7 : 6} className="py-8 text-center text-gray-400">
                        Loading stale payouts...
                      </td>
                    </tr>
                  ) : modalItems.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'restaurant' ? 7 : 6} className="py-8 text-center text-gray-400">
                        No stale payouts found for &gt; {modalFilterDays} days threshold.
                      </td>
                    </tr>
                  ) : (
                    modalItems.map((item, idx) => {
                      const payoutId = item.payoutId;
                      const entityId = (item as any).ownerId || (item as any).riderId || '—';
                      const amount = (item as any).netPayoutAmount ?? (item as any).netPayable ?? 0;
                      const isRest = activeTab === 'restaurant';
                      const restItem = item as StaleRestaurantPayout;

                      return (
                        <tr key={payoutId || idx} className="hover:bg-amber-50/20">
                          <td className="py-3 px-4 font-mono text-[11px] text-gray-600 font-semibold">{payoutId}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-gray-900 font-bold">{entityId}</td>
                          <td className="py-3 px-4 font-bold text-gray-900">₹{amount.toLocaleString()}</td>
                          <td className="py-3 px-4 font-bold text-amber-700">
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold">
                              {item.daysStale} days
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-gray-500">
                            {item.exportBatchId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.exportBatchId) onSelectBatchId?.(item.exportBatchId);
                                  setIsModalOpen(false);
                                }}
                                className="text-red-600 hover:underline font-bold"
                              >
                                {item.exportBatchId}
                              </button>
                            ) : (
                              'Not Exported'
                            )}
                          </td>
                          {isRest && (
                            <td className="py-3 px-4 text-[11px] text-gray-500">
                              {restItem.bankAccountNumber ? (
                                <div>
                                  <span className="font-mono font-medium block">{restItem.bankAccountNumber}</span>
                                  <span className="text-[10px] text-gray-400 font-mono">{restItem.bankIfscCode}</span>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                          )}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isSuperAdmin() && (
                                <button
                                  type="button"
                                  onClick={() => setManualResolveTarget(payoutId)}
                                  className="px-2.5 py-1 rounded-lg bg-red-50 text-[#d72b1f] hover:bg-red-100 text-[11px] font-bold border border-red-200 transition-colors flex items-center gap-1"
                                >
                                  <ShieldAlert className="w-3 h-3" />
                                  Manual Resolve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 shrink-0 text-xs text-gray-500">
              <span>Showing {modalItems.length} stale payout entries (&gt; {modalFilterDays} days)</span>
              <Button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 h-8 rounded-xl font-bold bg-gray-900 text-white text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Resolve Modal from Stale Table */}
      <ManualResolveModal
        isOpen={!!manualResolveTarget}
        payoutId={manualResolveTarget}
        isRider={activeTab === 'rider'}
        onClose={() => setManualResolveTarget(null)}
        onSuccess={handleManualResolveSuccess}
      />
    </>
  );
}

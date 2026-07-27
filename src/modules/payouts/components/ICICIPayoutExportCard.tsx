import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  Building2, 
  UserCheck, 
  Calendar
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { payoutService, type ExportMeta, ExportError } from '@/core/api/payouts';
import toast from 'react-hot-toast';

interface ICICIPayoutExportCardProps {
  activeTab: 'restaurant' | 'rider';
  onTabChange?: (tab: 'restaurant' | 'rider') => void;
}

// Utility to calculate default last week (Monday to Sunday)
function getLastWeekDateRange() {
  const now = new Date();
  const day = now.getDay(); // 0 is Sun, 1 is Mon, ...
  const diffToLastMonday = (day === 0 ? 6 : day - 1) + 7;
  
  const lastMon = new Date(now);
  lastMon.setDate(now.getDate() - diffToLastMonday);
  
  const lastSun = new Date(lastMon);
  lastSun.setDate(lastMon.getDate() + 6);
  
  const toYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  return {
    start: toYmd(lastMon),
    end: toYmd(lastSun),
  };
}

function getTwoWeeksAgoDateRange() {
  const lastWeek = getLastWeekDateRange();
  const startD = new Date(lastWeek.start);
  const endD = new Date(lastWeek.end);
  startD.setDate(startD.getDate() - 7);
  endD.setDate(endD.getDate() - 7);

  const toYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  return {
    start: toYmd(startD),
    end: toYmd(endD),
  };
}

export default function ICICIPayoutExportCard({ activeTab, onTabChange }: ICICIPayoutExportCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const defaultRange = getLastWeekDateRange();

  const [exportType, setExportType] = useState<'restaurant' | 'rider'>(activeTab);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [copiedBatchId, setCopiedBatchId] = useState(false);

  // Synchronize with parent active tab if parent changes
  React.useEffect(() => {
    setExportType(activeTab);
  }, [activeTab]);

  // Export Results state
  const [lastMetaResult, setLastMetaResult] = useState<{
    meta: ExportMeta;
    type: 'restaurant' | 'rider';
    periodStart: string;
    periodEnd: string;
  } | null>(null);

  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Mutation for Export
  const exportMutation = useMutation({
    mutationFn: async () => {
      setEmptyNotice(null);
      setErrorNotice(null);

      if (exportType === 'restaurant') {
        return await payoutService.exportRestaurantPayouts(startDate, endDate);
      } else {
        // Formulate ISO Utc timestamps with Z suffix for riders
        const cycleStartUtc = `${startDate}T00:00:00Z`;
        // To cover the full sunday end date, use next day 00:00:00Z or date T00:00:00Z
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const nextDayStr = endDateObj.toISOString().split('T')[0];
        const cycleEndUtc = `${nextDayStr}T00:00:00Z`;

        return await payoutService.exportRiderPayouts(cycleStartUtc, cycleEndUtc);
      }
    },
    onSuccess: (meta) => {
      toast.success(`ICICI Payout File Downloaded! (${meta.rowCount} rows)`);
      setLastMetaResult({
        meta,
        type: exportType,
        periodStart: startDate,
        periodEnd: endDate,
      });

      // Invalidate relevant queries so statuses update to 'Processing'
      queryClient.invalidateQueries({ queryKey: ['payoutSummary'] });
      queryClient.invalidateQueries({ queryKey: ['restaurantPayouts'] });
      queryClient.invalidateQueries({ queryKey: ['riderPayoutSummary'] });
      queryClient.invalidateQueries({ queryKey: ['riderPayouts'] });
    },
    onError: (err: any) => {
      if (err instanceof ExportError && err.isNotFound) {
        setEmptyNotice('Nothing to export for this week');
        setLastMetaResult(null);
      } else {
        const msg = err.message || err.response?.data?.message || 'Export failed. Please check period and try again.';
        setErrorNotice(msg);
        toast.error(msg);
      }
    },
  });

  const handleCopyBatchId = (batchId: string) => {
    navigator.clipboard.writeText(batchId);
    setCopiedBatchId(true);
    toast.success('Batch ID copied to clipboard');
    setTimeout(() => setCopiedBatchId(false), 2000);
  };

  const handlePresetSelect = (preset: 'lastWeek' | 'twoWeeksAgo') => {
    const range = preset === 'lastWeek' ? getLastWeekDateRange() : getTwoWeeksAgoDateRange();
    setStartDate(range.start);
    setEndDate(range.end);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/50 mb-8 relative overflow-hidden">
      {/* Decorative Glow Background Effect */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/60 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-bold">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">ICICI Bulk Payout Export</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Ready for Transfer
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Generate ready-to-upload ICICI bank transfer files for weekly restaurant and rider payouts
            </p>
          </div>
        </div>

        {/* Export Type Toggle */}
        <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setExportType('restaurant');
              onTabChange?.('restaurant');
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              exportType === 'restaurant'
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            Restaurant Export
          </button>
          <button
            type="button"
            onClick={() => {
              setExportType('rider');
              onTabChange?.('rider');
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              exportType === 'rider'
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Rider Export
          </button>
        </div>
      </div>

      {/* Control Area: Date Pickers & Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 my-6 relative z-10">
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" />
              Payout Window ({exportType === 'restaurant' ? 'Date Period' : 'UTC Cycle'})
            </label>
            
            {/* Quick Presets */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePresetSelect('lastWeek')}
                className="text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 px-2.5 py-1 rounded-md border border-slate-700 transition-colors"
              >
                Last Week (Mon–Sun)
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('twoWeeksAgo')}
                className="text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 px-2.5 py-1 rounded-md border border-slate-700 transition-colors"
              >
                2 Weeks Ago
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-1">
                {exportType === 'restaurant' ? 'Period Start (Monday)' : 'Cycle Start (UTC)'}
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
              />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-1">
                {exportType === 'restaurant' ? 'Period End (Sunday)' : 'Cycle End (UTC)'}
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="lg:col-span-4 flex flex-col justify-end">
          <Button
            type="button"
            disabled={exportMutation.isPending || !startDate || !endDate}
            onClick={() => exportMutation.mutate()}
            className={cn(
              "w-full h-[46px] rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2",
              exportType === 'restaurant'
                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 shadow-orange-500/25"
                : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 shadow-teal-500/25"
            )}
          >
            {exportMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating ICICI File...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export {exportType === 'restaurant' ? 'Restaurant' : 'Rider'} ICICI File</span>
                <Download className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Empty Notice State (404) */}
      {emptyNotice && (
        <div className="mt-4 bg-slate-800/90 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3 relative z-10 animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-300">Nothing to export for this week</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              No Pending payouts exist for the selected {exportType} window ({startDate} to {endDate}). This usually means payouts for this week have already been exported or no new pending balances were queued.
            </p>
          </div>
        </div>
      )}

      {/* Error Notice State (400 / unexpected) */}
      {errorNotice && (
        <div className="mt-4 bg-red-950/60 border border-red-500/50 rounded-xl p-4 flex items-start gap-3 relative z-10 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-red-300">Export Unsuccessful</h4>
            <p className="text-xs text-red-200 mt-0.5">{errorNotice}</p>
          </div>
        </div>
      )}

      {/* Export Result Receipt (Inline) */}
      {lastMetaResult && (
        <div className="mt-6 bg-slate-800/90 border border-slate-700 rounded-2xl p-5 relative z-10 animate-in slide-in-from-bottom-2 duration-300 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/80">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">ICICI Bulk File Exported Successfully</h3>
                <p className="text-xs text-slate-300">
                  Target: <span className="capitalize font-semibold text-white">{lastMetaResult.type}</span> • Window: {lastMetaResult.periodStart} to {lastMetaResult.periodEnd}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> File Downloaded (.xlsx)
              </span>
            </div>
          </div>

          {/* Key Metrics Receipt Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                Export Batch ID
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-amber-300 truncate" title={lastMetaResult.meta.exportBatchId}>
                  {lastMetaResult.meta.exportBatchId || '—'}
                </span>
                {lastMetaResult.meta.exportBatchId && (
                  <button
                    type="button"
                    onClick={() => handleCopyBatchId(lastMetaResult.meta.exportBatchId)}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                    title="Copy Batch ID"
                  >
                    {copiedBatchId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                Beneficiary Rows
              </span>
              <span className="text-lg font-bold text-white">
                {lastMetaResult.meta.rowCount ?? 0} <span className="text-xs text-slate-400 font-normal">rows included</span>
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                Control Sum Total
              </span>
              <span className="text-lg font-bold text-emerald-400">
                ₹{(lastMetaResult.meta.controlSumTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * Note: Verify the Control Sum Total above against ICICI Corporate Portal's total sum prompt after uploading the generated bulk file.
          </p>

          {/* Exclusions Section */}
          {lastMetaResult.meta.excluded && lastMetaResult.meta.excluded.length > 0 && (
            <div className="mt-5 pt-5 border-t border-slate-700/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-amber-300">
                    Excluded Payouts ({lastMetaResult.meta.excluded.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  These payouts were skipped during export and remain in Pending status.
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/80">
                    <tr>
                      <th className="py-2.5 px-3.5">Payout ID</th>
                      <th className="py-2.5 px-3.5">{lastMetaResult.type === 'restaurant' ? 'Owner ID' : 'Rider ID'}</th>
                      <th className="py-2.5 px-3.5">Amount</th>
                      <th className="py-2.5 px-3.5">Reason</th>
                      <th className="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-slate-200">
                    {lastMetaResult.meta.excluded.map((item, idx) => {
                      const entityId = item.ownerId || item.riderId || 'N/A';
                      const amountVal = item.netPayoutAmount ?? item.netPayable ?? 0;
                      return (
                        <tr key={item.payoutId || idx} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-300">{item.payoutId}</td>
                          <td className="py-2.5 px-3.5 font-mono text-[11px] text-amber-200">{entityId}</td>
                          <td className="py-2.5 px-3.5 font-semibold text-white">₹{amountVal.toLocaleString()}</td>
                          <td className="py-2.5 px-3.5 text-amber-300">{item.reason}</td>
                          <td className="py-2.5 px-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (lastMetaResult.type === 'restaurant') {
                                  navigate('/owners');
                                } else {
                                  navigate('/riders');
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              <span>Fix Bank Details</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

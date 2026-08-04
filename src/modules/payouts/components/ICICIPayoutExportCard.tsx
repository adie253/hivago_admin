import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Copy, 
  Check, 
  Building2, 
  UserCheck, 
  Calendar,
  UploadCloud,
  FileUp,
  X,
  History,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { 
  payoutService, 
  isSuperAdmin,
  extractErrorMessage,
  type ExportMeta, 
  type ReconcileResult,
  type BatchSummary,
  ExportError 
} from '@/core/api/payouts';
import ManualResolveModal from './ManualResolveModal';
import toast from 'react-hot-toast';

interface ICICIPayoutExportCardProps {
  activeTab: 'restaurant' | 'rider';
  onTabChange?: (tab: 'restaurant' | 'rider') => void;
  prefilledBatchId?: string | null;
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

export default function ICICIPayoutExportCard({ activeTab, onTabChange, prefilledBatchId }: ICICIPayoutExportCardProps) {
  const queryClient = useQueryClient();
  const defaultRange = getLastWeekDateRange();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Main Action Mode: Export vs Reconcile Upload vs Batches History
  const [actionMode, setActionMode] = useState<'export' | 'reconcile' | 'batches'>('export');
  const [exportType, setExportType] = useState<'restaurant' | 'rider'>(activeTab);

  // Synchronize with parent active tab if parent changes
  React.useEffect(() => {
    setExportType(activeTab);
  }, [activeTab]);

  // Export State
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [copiedBatchId, setCopiedBatchId] = useState(false);

  const [lastMetaResult, setLastMetaResult] = useState<{
    meta: ExportMeta;
    type: 'restaurant' | 'rider';
    periodStart: string;
    periodEnd: string;
  } | null>(null);

  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Step 1: Reconcile Upload State
  const [reconcileBatchId, setReconcileBatchId] = useState<string>(prefilledBatchId || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);

  // Manual Resolve Target Modal State
  const [manualResolvePayoutId, setManualResolvePayoutId] = useState<string | null>(null);

  // Synchronize prefilled Batch ID if passed from parent/batches
  React.useEffect(() => {
    if (prefilledBatchId) {
      setReconcileBatchId(prefilledBatchId);
      setActionMode('reconcile');
    }
  }, [prefilledBatchId]);

  // Query Step 2: Batches List
  const { data: batchesData, isLoading: isLoadingBatches, refetch: refetchBatches } = useQuery({
    queryKey: ['payoutBatches', exportType],
    queryFn: async () => {
      if (exportType === 'restaurant') {
        return await payoutService.getRestaurantBatches();
      } else {
        return await payoutService.getRiderBatches();
      }
    },
    enabled: actionMode === 'batches',
  });

  const batchesList: BatchSummary[] = Array.isArray(batchesData) 
    ? batchesData 
    : (batchesData as any)?.items || [];

  // Mutation for Export
  const exportMutation = useMutation({
    mutationFn: async () => {
      setEmptyNotice(null);
      setErrorNotice(null);

      if (exportType === 'restaurant') {
        return await payoutService.exportRestaurantPayouts(startDate, endDate);
      } else {
        const cycleStartUtc = `${startDate}T00:00:00Z`;
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
      if (meta.exportBatchId) {
        setReconcileBatchId(meta.exportBatchId);
      }

      queryClient.invalidateQueries({ queryKey: ['payoutSummary'] });
      queryClient.invalidateQueries({ queryKey: ['restaurantPayouts'] });
      queryClient.invalidateQueries({ queryKey: ['riderPayoutSummary'] });
      queryClient.invalidateQueries({ queryKey: ['riderPayouts'] });
      queryClient.invalidateQueries({ queryKey: ['payoutBatches'] });
    },
    onError: (err: any) => {
      if (err instanceof ExportError && err.isNotFound) {
        setEmptyNotice('Nothing to export for this week');
        setLastMetaResult(null);
      } else {
        const msg = extractErrorMessage(err, 'Export failed. Please check period and try again.');
        setErrorNotice(msg);
        toast.error(msg);
      }
    },
  });

  // Step 1: Mutation for Reconciling ICICI Response File
  const reconcileMutation = useMutation({
    mutationFn: async () => {
      if (!reconcileBatchId.trim()) throw new Error('Please enter or select a Batch ID.');
      if (!selectedFile) throw new Error('Please select an ICICI response file to upload.');

      if (exportType === 'restaurant') {
        return await payoutService.reconcileRestaurantPayouts(reconcileBatchId.trim(), selectedFile);
      } else {
        return await payoutService.reconcileRiderPayouts(reconcileBatchId.trim(), selectedFile);
      }
    },
    onSuccess: (data) => {
      toast.success('ICICI Bank Response File Reconciled Successfully!');
      setReconcileResult(data);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Invalidate relevant queries so tables immediately show Paid / Failed
      queryClient.invalidateQueries({ queryKey: ['payoutSummary'] });
      queryClient.invalidateQueries({ queryKey: ['restaurantPayouts'] });
      queryClient.invalidateQueries({ queryKey: ['riderPayoutSummary'] });
      queryClient.invalidateQueries({ queryKey: ['riderPayouts'] });
      queryClient.invalidateQueries({ queryKey: ['payoutBatches'] });
      queryClient.invalidateQueries({ queryKey: ['stalePayouts'] });
    },
    onError: (err: any) => {
      // Step 5: Handle body.message ?? body.error formats
      const msg = extractErrorMessage(err, 'Reconciliation failed. Please check batch ID and file.');
      toast.error(msg);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setReconcileResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
        setSelectedFile(file);
        setReconcileResult(null);
      } else {
        toast.error('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      }
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-[#d72b1f] border border-red-100 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">
                ICICI Bulk Payout & Bank Reconciliation
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Bulk Transfer Workflow
              </span>
            </div>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Export ICICI transfer files, view batches, or reconcile bank confirmation files
            </p>
          </div>
        </div>

        {/* Action Modes & Entity Switcher */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Main Action Switcher */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setActionMode('export')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                actionMode === 'export'
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Download className="w-3.5 h-3.5" />
              1. Download Export
            </button>

            <button
              type="button"
              onClick={() => setActionMode('reconcile')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                actionMode === 'reconcile'
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <FileUp className="w-3.5 h-3.5" />
              2. Reconcile Upload
            </button>

            <button
              type="button"
              onClick={() => setActionMode('batches')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                actionMode === 'batches'
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <History className="w-3.5 h-3.5" />
              3. Batches History
            </button>
          </div>

          {/* Restaurant / Rider Type Switcher */}
          <div className="flex items-center bg-gray-100/80 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => {
                setExportType('restaurant');
                onTabChange?.('restaurant');
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                exportType === 'restaurant'
                  ? "bg-[#d72b1f] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Building2 className="w-3.5 h-3.5" />
              Restaurant
            </button>
            <button
              type="button"
              onClick={() => {
                setExportType('rider');
                onTabChange?.('rider');
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                exportType === 'rider'
                  ? "bg-[#059669] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Rider
            </button>
          </div>
        </div>
      </div>

      {/* MODE 1: EXPORT ICICI FILE */}
      {actionMode === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-400" />
                Payout Window ({exportType === 'restaurant' ? 'Date Period' : 'UTC Cycle'})
              </label>
              
              {/* Quick Presets */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePresetSelect('lastWeek')}
                  className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1 rounded-lg transition-colors"
                >
                  Last Week (Mon–Sun)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect('twoWeeksAgo')}
                  className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1 rounded-lg transition-colors"
                >
                  2 Weeks Ago
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-semibold text-gray-500 block mb-1">
                  {exportType === 'restaurant' ? 'Period Start (Monday)' : 'Cycle Start (UTC)'}
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-800 focus:outline-none focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono"
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-gray-500 block mb-1">
                  {exportType === 'restaurant' ? 'Period End (Sunday)' : 'Cycle End (UTC)'}
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-800 focus:outline-none focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono"
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
                "w-full h-[44px] rounded-xl font-bold text-xs text-white shadow-sm transition-all flex items-center justify-center gap-2",
                exportType === 'restaurant'
                  ? "bg-[#d72b1f] hover:bg-red-700 shadow-red-100"
                  : "bg-[#059669] hover:bg-emerald-700 shadow-emerald-100"
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
                  <span>Download Payout File (.xlsx)</span>
                  <Download className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* MODE 2: STEP 1 - RECONCILE UPLOAD */}
      {actionMode === 'reconcile' && (
        <div className="pt-5 space-y-4">
          {!isSuperAdmin() ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">Super Admin Access Required</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Only a Super Admin can upload ICICI reconciliation response files to mark payouts as Paid or Failed.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Batch ID Input */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <label className="text-xs font-bold text-gray-800 block">
                  Target Export Batch ID <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={reconcileBatchId}
                    onChange={(e) => setReconcileBatchId(e.target.value)}
                    placeholder="Enter or select Batch ID (e.g. batch-20260804-001)"
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-gray-900 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setActionMode('batches')}
                    className="px-3.5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold transition-colors"
                  >
                    Browse Batches
                  </button>
                </div>
              </div>

              {/* Drag & Drop File Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2",
                  isDragOver ? "border-red-500 bg-red-50/30 scale-[0.99]" :
                  selectedFile ? "border-emerald-300 bg-emerald-50/20" : "border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex items-center gap-4 bg-white border border-emerald-200 rounded-xl p-3 px-5 shadow-sm max-w-lg w-full">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left truncate">
                      <h4 className="text-xs font-bold text-gray-900 truncate">{selectedFile.name}</h4>
                      <p className="text-[11px] text-gray-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB • ICICI Bank Response File
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-red-50 text-[#d72b1f] border border-red-100 flex items-center justify-center mb-1">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-gray-800">
                      Click to choose or drag & drop ICICI bank response file (.xlsx / .csv)
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Super Admin role verified • Safe to re-upload (already resolved rows will be skipped)
                    </p>
                  </>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  disabled={!selectedFile || !reconcileBatchId.trim() || reconcileMutation.isPending}
                  onClick={() => reconcileMutation.mutate()}
                  className={cn(
                    "h-[42px] px-6 rounded-xl font-bold text-xs text-white shadow-sm transition-all flex items-center gap-2",
                    selectedFile && reconcileBatchId.trim()
                      ? "bg-[#d72b1f] hover:bg-red-700 shadow-red-100"
                      : "bg-gray-300 cursor-not-allowed"
                  )}
                >
                  {reconcileMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Reconciling Payouts...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Reconcile {exportType === 'restaurant' ? 'Restaurant' : 'Rider'} Batch</span>
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Reconcile Summary Receipt */}
          {reconcileResult && (
            <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4 animate-in slide-in-from-bottom-2 duration-300 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="text-xs font-bold text-gray-900">ICICI Bank Statement Reconciled</h3>
                    <p className="text-[11px] text-gray-500">
                      Batch ID: <span className="font-mono font-semibold text-gray-800">{reconcileResult.exportBatchId}</span>
                    </p>
                  </div>
                </div>

                <span className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-bold border self-start sm:self-auto",
                  reconcileResult.batchFullyReconciled 
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-900 border-amber-300"
                )}>
                  {reconcileResult.batchFullyReconciled ? 'Batch Fully Reconciled' : 'Open Items Remain'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Rows In File</span>
                  <span className="text-base font-bold text-gray-900">{reconcileResult.rowsInFile}</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Marked Paid</span>
                  <span className="text-base font-bold text-emerald-600">{reconcileResult.markedPaid}</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Marked Failed</span>
                  <span className="text-base font-bold text-red-600">{reconcileResult.markedFailed}</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Already Resolved</span>
                  <span className="text-base font-bold text-blue-600">{reconcileResult.alreadyResolvedSkipped}</span>
                </div>
              </div>

              {/* Not fully reconciled explicit notice */}
              {!reconcileResult.batchFullyReconciled && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">
                    <strong>Batch still has open items:</strong> A fuller report may need to be uploaded, or resolve the remaining rows manually.
                  </p>
                </div>
              )}

              {/* Unresolved items table */}
              {reconcileResult.unresolved && reconcileResult.unresolved.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Unresolved Items Requiring Human Decision ({reconcileResult.unresolved.length})
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-3.5">Row #</th>
                          <th className="py-2.5 px-3.5">Beneficiary Name</th>
                          <th className="py-2.5 px-3.5">Account Number</th>
                          <th className="py-2.5 px-3.5">Amount</th>
                          <th className="py-2.5 px-3.5">Reason</th>
                          <th className="py-2.5 px-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {reconcileResult.unresolved.map((item, idx) => (
                          <tr key={idx} className="hover:bg-amber-50/20">
                            <td className="py-2.5 px-3.5 font-mono text-gray-600">{item.rowNumber}</td>
                            <td className="py-2.5 px-3.5 font-bold text-gray-900">{item.beneficiaryName}</td>
                            <td className="py-2.5 px-3.5 font-mono text-gray-600">{item.accountNumber}</td>
                            <td className="py-2.5 px-3.5 font-bold text-gray-900">₹{(item.amount ?? 0).toLocaleString()}</td>
                            <td className="py-2.5 px-3.5 text-amber-800">{item.reason}</td>
                            <td className="py-2.5 px-3.5 text-right">
                              {isSuperAdmin() && (
                                <button
                                  type="button"
                                  onClick={() => setManualResolvePayoutId(`row-${item.rowNumber}`)}
                                  className="text-xs font-bold text-[#d72b1f] hover:underline"
                                >
                                  Manual Resolve
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 3: STEP 2 - BATCHES HISTORY LIST */}
      {actionMode === 'batches' && (
        <div className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              {exportType === 'restaurant' ? 'Restaurant' : 'Rider'} Export Batches History
            </h3>
            <button
              type="button"
              onClick={() => refetchBatches()}
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Batch ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Rows</th>
                  <th className="py-3 px-4">Control Sum</th>
                  <th className="py-3 px-4">Breakdown (Proc / Paid / Fail)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {isLoadingBatches ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="py-4 px-4 bg-gray-50/50">Loading batches...</td>
                    </tr>
                  ))
                ) : batchesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No exported batches found for {exportType}.
                    </td>
                  </tr>
                ) : (
                  batchesList.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50/80">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {batch.periodStart} to {batch.periodEnd}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-600 font-semibold">{batch.id}</td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded text-[11px] font-bold border",
                          batch.status === 'Reconciled'
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {batch.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold">{batch.rowCount}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">₹{(batch.controlSumTotal ?? 0).toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-amber-700 font-bold">{batch.processingCount} proc</span> •
                          <span className="text-emerald-700 font-bold">{batch.paidCount} paid</span> •
                          <span className="text-red-600 font-bold">{batch.failedCount} fail</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {batch.processingCount > 0 && isSuperAdmin() && (
                          <Button
                            type="button"
                            onClick={() => {
                              setReconcileBatchId(batch.id);
                              setActionMode('reconcile');
                            }}
                            className="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#d72b1f] hover:bg-red-700 text-white"
                          >
                            Reconcile
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty Notice State */}
      {emptyNotice && actionMode === 'export' && (
        <div className="mt-4 bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-900">Nothing to export for this week</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              No Pending payouts exist for the selected {exportType} window ({startDate} to {endDate}). This usually means payouts for this week have already been exported or no pending balances were queued.
            </p>
          </div>
        </div>
      )}

      {/* Error Notice State */}
      {errorNotice && actionMode === 'export' && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-red-900">Export Unsuccessful</h4>
            <p className="text-xs text-red-700 mt-0.5">{errorNotice}</p>
          </div>
        </div>
      )}

      {/* Export Result Receipt (Inline) */}
      {lastMetaResult && actionMode === 'export' && (
        <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-xs font-bold text-gray-900">ICICI Bulk Transfer File Exported Successfully</h3>
                <p className="text-[11px] text-gray-500">
                  Target: <span className="capitalize font-semibold text-gray-800">{lastMetaResult.type}</span> • Window: {lastMetaResult.periodStart} to {lastMetaResult.periodEnd}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> File Downloaded (.xlsx)
              </span>
            </div>
          </div>

          {/* Key Metrics Receipt Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                Export Batch ID
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-gray-900 truncate" title={lastMetaResult.meta.exportBatchId}>
                  {lastMetaResult.meta.exportBatchId || '—'}
                </span>
                {lastMetaResult.meta.exportBatchId && (
                  <button
                    type="button"
                    onClick={() => handleCopyBatchId(lastMetaResult.meta.exportBatchId)}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
                    title="Copy Batch ID"
                  >
                    {copiedBatchId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                Beneficiary Rows
              </span>
              <span className="text-base font-bold text-gray-900">
                {lastMetaResult.meta.rowCount ?? 0} <span className="text-xs text-gray-500 font-normal">rows included</span>
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                Control Sum Total
              </span>
              <span className="text-base font-bold text-[#059669]">
                ₹{(lastMetaResult.meta.controlSumTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 italic">
            * Note: Verify the Control Sum Total above against ICICI Corporate Portal's prompt after uploading the generated bulk file.
          </p>
        </div>
      )}

      {/* Manual Resolve Modal from Unresolved Items */}
      <ManualResolveModal
        isOpen={!!manualResolvePayoutId}
        payoutId={manualResolvePayoutId}
        isRider={exportType === 'rider'}
        onClose={() => setManualResolvePayoutId(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['payoutSummary'] });
          queryClient.invalidateQueries({ queryKey: ['restaurantPayouts'] });
          queryClient.invalidateQueries({ queryKey: ['riderPayoutSummary'] });
          queryClient.invalidateQueries({ queryKey: ['riderPayouts'] });
          queryClient.invalidateQueries({ queryKey: ['payoutBatches'] });
        }}
      />
    </div>
  );
}

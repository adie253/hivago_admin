import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { isSuperAdmin, extractErrorMessage, payoutService, type ManualResolveRequest } from '@/core/api/payouts';
import toast from 'react-hot-toast';

interface ManualResolveModalProps {
  isOpen: boolean;
  payoutId: string | null;
  isRider: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ManualResolveModal({
  isOpen,
  payoutId,
  isRider,
  onClose,
  onSuccess,
}: ManualResolveModalProps) {
  const [outcome, setOutcome] = useState<'Paid' | 'Failed'>('Paid');
  const [utr, setUtr] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !payoutId) return null;

  // Gate form check: SuperAdmin check
  if (!isSuperAdmin()) {
    return (
      <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-red-200 shadow-xl space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Super Admin Access Required</h3>
          <p className="text-xs text-gray-600">
            Only a Super Admin can manually resolve processing payouts. This action self-attests payment resolution.
          </p>
          <Button type="button" onClick={onClose} className="w-full bg-gray-900 text-white rounded-xl">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (outcome === 'Paid' && !utr.trim()) {
      toast.error('Transaction Reference (UTR) is required when marking payout as Paid.');
      return;
    }

    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters long.');
      return;
    }

    const payload: ManualResolveRequest = {
      outcome,
      transactionReference: outcome === 'Paid' ? utr.trim() : undefined,
      reason: reason.trim(),
    };

    setIsSubmitting(true);
    try {
      if (isRider) {
        await payoutService.manualResolveRiderPayout(payoutId, payload);
      } else {
        await payoutService.manualResolveRestaurantPayout(payoutId, payload);
      }
      toast.success(`Payout manually resolved as ${outcome}`);
      onSuccess();
      onClose();
      // Reset form
      setUtr('');
      setReason('');
      setOutcome('Paid');
    } catch (err: any) {
      const msg = extractErrorMessage(err, 'Failed to resolve payout');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Manual Resolve Payout</h3>
              <p className="text-[11px] text-gray-500 font-mono truncate max-w-[260px]">ID: {payoutId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-4 space-y-4">
          {/* Outcome Toggle */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">Resolution Outcome</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOutcome('Paid')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                  outcome === 'Paid'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Mark as Paid
              </button>
              <button
                type="button"
                onClick={() => setOutcome('Failed')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                  outcome === 'Failed'
                    ? 'bg-red-50 border-red-500 text-red-700 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <XCircle className="w-4 h-4 text-red-600" />
                Mark as Failed
              </button>
            </div>
          </div>

          {/* UTR Reference (Required if outcome is Paid) */}
          {outcome === 'Paid' && (
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Transaction Reference / UTR <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="e.g. ICICIN20260804123456"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                required
              />
            </div>
          )}

          {/* Reason Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700">
                Resolution Reason / Audit Note <span className="text-red-500">*</span>
              </label>
              <span className={`text-[10px] font-bold ${reason.trim().length >= 10 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {reason.trim().length} / 10 min chars
              </span>
            </div>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Confirmed directly in ICICI portal statement dated 2026-08-04. Bank UTR matched..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              className="px-4 h-[38px] rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 10 || (outcome === 'Paid' && !utr.trim())}
              className="px-5 h-[38px] rounded-xl text-xs font-bold text-white bg-[#d72b1f] hover:bg-red-700 disabled:opacity-40 shadow-sm"
            >
              {isSubmitting ? 'Resolving...' : `Confirm & Mark ${outcome}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

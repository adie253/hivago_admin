import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Eye, Calendar, Hash, DollarSign, Percent, AlertCircle } from 'lucide-react';
import { payoutService, type RestaurantPayoutLedgerEntry } from '@/core/api/payouts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import TransactionDetailsView from './TransactionDetailsView';
import type { TransactionData } from './TransactionDetailsView';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

interface OrderLevelBreakdownProps {
  payoutId: string;
  restaurantName?: string;
  onBack: () => void;
}

export default function OrderLevelBreakdown({ payoutId, restaurantName, onBack }: OrderLevelBreakdownProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionData | null>(null);

  // Fetch Payout Breakdown for given payoutId
  const { data: breakdown, isLoading, error } = useQuery({
    queryKey: ['restaurantPayoutBreakdown', payoutId],
    queryFn: () => payoutService.getRestaurantPayoutBreakdown(payoutId),
    enabled: !!payoutId,
  });

  const handleExportCSV = () => {
    if (!breakdown?.ledgerEntries || breakdown.ledgerEntries.length === 0) {
      toast.error('No ledger entries available to export');
      return;
    }

    const headers = ['Order Number', 'Date (UTC)', 'Order Amount', 'GST Amount', 'Commission Amount', 'Commission GST', 'TDS Amount', 'Net Amount', 'Status'];
    const csvRows = [headers.join(',')];

    breakdown.ledgerEntries.forEach((entry) => {
      const row = [
        `"${entry.orderNumber || entry.orderId}"`,
        `"${entry.createdAtUtc}"`,
        entry.orderAmount,
        entry.gstAmount,
        entry.commissionAmount,
        entry.commissionGst,
        entry.tdsAmount,
        entry.netAmount,
        `"${entry.status}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payout-${breakdown.payoutId.substring(0, 8)}-breakdown.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported breakdown to CSV');
  };

  if (selectedTransaction) {
    return (
      <TransactionDetailsView 
        transaction={selectedTransaction} 
        onBack={() => setSelectedTransaction(null)} 
      />
    );
  }

  const formatCurrency = (val: number | undefined) => {
    return `₹${(val ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-7xl animate-in fade-in duration-300 pb-10">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[20px] font-bold text-gray-900 tracking-tight">Order Level Breakdown</h1>
            <p className="text-[13px] text-gray-500 font-medium">
              {breakdown?.displayName || restaurantName || 'Restaurant Payout Details'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleExportCSV}
          disabled={!breakdown?.ledgerEntries?.length}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 text-gray-700 font-bold text-[13px] shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export Order Details
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            {(error as any)?.response?.data?.message || 'Failed to load order-level breakdown for this payout.'}
          </p>
        </div>
      ) : null}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Cycle</span>
          </div>
          <div className="text-[13px] font-bold text-gray-800">
            {isLoading ? '...' : `${breakdown?.cycleStart || '—'} to ${breakdown?.cycleEnd || '—'}`}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Hash className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Orders</span>
          </div>
          <div className="text-[18px] font-bold text-gray-900">
            {isLoading ? '...' : breakdown?.orderCount ?? 0}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Gross Order</span>
          </div>
          <div className="text-[16px] font-bold text-gray-900">
            {isLoading ? '...' : formatCurrency(breakdown?.grossOrderAmount)}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Percent className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Commission</span>
          </div>
          <div className="text-[16px] font-bold text-purple-700">
            {isLoading ? '...' : formatCurrency(breakdown?.totalCommission)}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">GST</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider">Comm. GST</span>
          </div>
          <div className="text-[16px] font-bold text-amber-700">
            {isLoading ? '...' : formatCurrency(breakdown?.totalCommissionGst)}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">TDS</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider">TDS (1%)</span>
          </div>
          <div className="text-[16px] font-bold text-red-600">
            {isLoading ? '...' : formatCurrency(breakdown?.totalTds)}
          </div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Net Payout</span>
            {breakdown?.status && (
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold border",
                breakdown.status === 'Pending' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                breakdown.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-300' :
                breakdown.status === 'Failed' ? 'bg-red-100 text-red-800 border-red-300' :
                'bg-blue-100 text-blue-800 border-blue-300'
              )}>
                {breakdown.status}
              </span>
            )}
          </div>
          <div className="text-[18px] font-bold text-emerald-700">
            {isLoading ? '...' : formatCurrency(breakdown?.netPayoutAmount)}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900">Ledger Entries</h2>
          <span className="text-[12px] text-gray-500 font-medium">
            Showing {breakdown?.ledgerEntries?.length || 0} order breakdown lines
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-gray-50/50">
              <TableHead className="py-4 px-6 text-gray-900 font-bold">Order Number</TableHead>
              <TableHead className="py-4 px-6 text-gray-900 font-bold">Date & Time</TableHead>
              <TableHead className="py-4 px-6 text-gray-900 font-bold">Order Amount</TableHead>
              <TableHead className="py-4 px-6 text-gray-900 font-bold">GST</TableHead>
              <TableHead className="py-4 px-6 text-gray-900 font-bold">Commission</TableHead>
              <TableHead className="py-4 px-6 text-gray-900 font-bold">Comm. GST</TableHead>
              <TableHead className="py-4 px-6 text-gray-900 font-bold">TDS</TableHead>
              <TableHead className="py-4 px-6 text-gray-900 font-bold">Net Amount</TableHead>
              <TableHead className="py-4 px-6 text-gray-900 font-bold">Status</TableHead>
              <TableHead className="py-4 px-4 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-gray-100 rounded w-full"></div></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !breakdown?.ledgerEntries || breakdown.ledgerEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                  No order ledger entries found for this payout.
                </TableCell>
              </TableRow>
            ) : (
              breakdown.ledgerEntries.map((row: RestaurantPayoutLedgerEntry) => {
                const isNegative = row.netAmount < 0;
                return (
                  <TableRow 
                    key={row.id} 
                    className="hover:bg-gray-50/50 group border-b border-gray-100 last:border-0"
                  >
                    <TableCell className="py-4 px-6 text-[14px] font-bold text-gray-900">
                      {row.orderNumber || row.orderId.substring(0, 8)}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-[13px] text-gray-600 font-medium whitespace-nowrap">
                      {formatDate(row.createdAtUtc)}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-[14px] text-gray-900 font-medium">
                      ₹{row.orderAmount}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-[13px] text-gray-600 font-medium">
                      ₹{row.gstAmount}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-[14px] font-medium text-purple-700">
                      <div>₹{row.commissionAmount}</div>
                      {(row.commissionPercentage > 0 || row.commissionFlatFee > 0) && (
                        <div className="text-[10px] text-gray-400 font-normal">
                          {row.commissionPercentage > 0 ? `${row.commissionPercentage}%` : ''}
                          {row.commissionPercentage > 0 && row.commissionFlatFee > 0 ? ' + ' : ''}
                          {row.commissionFlatFee > 0 ? `₹${row.commissionFlatFee} flat` : ''}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-[13px] text-amber-700 font-medium">
                      ₹{row.commissionGst}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-[13px] text-red-600 font-medium">
                      ₹{row.tdsAmount}
                    </TableCell>
                    <TableCell className={cn(
                      "py-4 px-6 text-[15px] font-bold",
                      isNegative ? "text-red-600" : "text-[#059669]"
                    )}>
                      ₹{row.netAmount}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                        row.status === 'Batched' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        row.status === 'Settled' ? 'bg-green-50 text-green-700 border-green-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      )}>
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 px-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedTransaction({
                            orderId: row.orderNumber || row.orderId,
                            transactionId: `TXN-${row.id.substring(0, 8)}`,
                            amount: row.netAmount,
                            date: formatDate(row.createdAtUtc),
                            customerName: `Order ${row.orderNumber || ''}`,
                            restaurantName: breakdown.displayName,
                            foodAmount: row.orderAmount,
                            gst: row.gstAmount,
                            deliveryFee: 0,
                            commission: row.commissionAmount
                          });
                        }}
                        title="View Detailed Transaction Summary"
                        className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors ml-auto flex items-center justify-center"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}

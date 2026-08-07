import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Search, 
  Download, 
  ShoppingBag, 
  Users, 
  XCircle, 
  Eye, 
  History,
  ChevronDown,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ordersService, type OrderStatus } from '@/core/api/orders';
import { cn } from '@/utils/cn';
import { format } from 'date-fns';
import OrderDetailsModal, { type OrderDetailsData } from '../../dashboard/components/OrderDetailsModal';
import RefundModal from '../../dashboard/components/RefundModal';
import AssignRiderModal from '../../dashboard/components/AssignRiderModal';
import { useDebounce } from '@/hooks/useDebounce';
import { CancelOrderModal } from '@/components/ui/CancelOrderModal';

const TABS = [
  { id: 'all', label: 'All Orders', icon: ShoppingBag, activeColor: 'text-[#059669]', activeBg: 'bg-[#ecfdf5]', activeBorder: 'border-[#059669]' },
  { id: 'active', label: 'Active', icon: Users, activeColor: 'text-gray-900', activeBg: 'bg-gray-50', activeBorder: 'border-gray-900' },
  { id: 'escalated', label: 'Escalated', icon: AlertCircle, activeColor: 'text-gray-900', activeBg: 'bg-gray-50', activeBorder: 'border-gray-900' },
  { id: 'failed', label: 'Failed', icon: History, activeColor: 'text-gray-900', activeBg: 'bg-gray-50', activeBorder: 'border-gray-900' },
];

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderDetailsData | null>(null);
  const [refundOrderNumber, setRefundOrderNumber] = useState<string | null>(null);
  const [assignRiderOrder, setAssignRiderOrder] = useState<{ id?: string; orderNumber: string } | null>(null);
  const [cancelConfirmData, setCancelConfirmData] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const detailsOrderId = selectedOrderDetails?.orderId || selectedOrderDetails?.originalOrder?.orderId || selectedOrderDetails?.originalOrder?.id || selectedOrderDetails?.id;

  const queryClient = useQueryClient();

  const cancelOrderMutation = useMutation({
    mutationFn: ({ orderId, reason, notes }: { orderId: string; reason: string; notes: string }) =>
      ordersService.cancelOrder(orderId, { reason, notes, forceCancel: true }),
    onSuccess: () => {
      toast.success(`Order cancelled successfully!`);
      queryClient.invalidateQueries({ queryKey: ['orders-raw'] });
      setCancelConfirmData(null);
      setSelectedOrderDetails(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to cancel order.');
    }
  });

  const refundOrderMutation = useMutation({
    mutationFn: (orderId: string) => ordersService.refundOrder(orderId),
    onSuccess: () => {
      toast.success(`Refund initiated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['orders-raw'] });
      setRefundOrderNumber(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to initiate refund.');
    }
  });

  const escalateOrderMutation = useMutation({
    mutationFn: (orderId: string) => ordersService.escalateOrder(orderId),
    onSuccess: () => {
      toast.success(`Order escalated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['orders-raw'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to escalate order.');
    }
  });

  const findOrderIdByNumber = (num: string) => {
    const cleanNum = num.replace('#', '').trim();
    const match = allOrders.find((o: any) => 
      o.orderNumber.replace('#', '').trim() === cleanNum ||
      o.orderId === cleanNum
    );
    return match?.orderId;
  };

  const debouncedSearchTerm = useDebounce(searchTerm.trim(), 300);

  const { data, isLoading } = useQuery({
    queryKey: ['orders-raw', activeTab, statusFilter, debouncedSearchTerm, page],
    queryFn: () => ordersService.getOrders({ 
      status: activeTab === 'all' ? (statusFilter === 'all' ? undefined : statusFilter) : activeTab, 
      search: debouncedSearchTerm && debouncedSearchTerm.length >= 3 ? undefined : (debouncedSearchTerm || undefined), // Only use API search if it's short or we want exact? No, let's stick to local for partial.
      page: debouncedSearchTerm ? 1 : page,
      pageSize: debouncedSearchTerm ? 500 : pageSize
    }),
    placeholderData: keepPreviousData,
    refetchInterval: 2 * 60 * 1000,
  });

  const allOrders = data?.items || [];
  const counts = data?.counts || { all: 0, active: 0, escalated: 0, failed: 0 };

  const filteredOrders = useMemo(() => {
    if (!debouncedSearchTerm) return allOrders;
    const term = debouncedSearchTerm.toLowerCase();
    return allOrders.filter(order => 
      order.orderNumber.toLowerCase().includes(term) ||
      order.customerName.toLowerCase().includes(term) ||
      order.restaurantName.toLowerCase().includes(term)
    );
  }, [allOrders, debouncedSearchTerm]);

  const orders = useMemo(() => {
    // If we're searching, we paginate the local filtered list
    if (debouncedSearchTerm) {
      const start = (page - 1) * pageSize;
      return filteredOrders.slice(start, start + pageSize);
    }
    // Otherwise, we use the API's already paginated list
    return allOrders;
  }, [allOrders, filteredOrders, debouncedSearchTerm, page, pageSize]);

  const totalCount = debouncedSearchTerm ? filteredOrders.length : (data?.totalCount || 0);
  
  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearchTerm, statusFilter]);

  const handleExport = async () => {
    try {
      const blob = await ordersService.exportOrders({ status: activeTab, search: debouncedSearchTerm });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Orders exported successfully!");
    } catch (error) {
      console.error('Export failed', error);
      toast.error("Failed to export orders.");
    }
  };

  const getStatusBadgeVariant = (status: string): any => {
    switch (status.toLowerCase()) {
      case 'escalated': return 'escalated';
      case 'delivering':
      case 'assigned':
      case 'picked_up':
      case 'pickedup': return 'delivering';
      case 'preparing': return 'preparing';
      case 'completed':
      case 'delivered': return 'completed';
      case 'failed':
      case 'cancelled':
      case 'rejected': return 'failed';
      case 'readyforpickup':
      case 'ready': return 'success';
      case 'confirmed': return 'info';
      case 'refunding':
      case 'refunded': return 'refunding';
      case 'pending':
      case 'placed':
      case 'paid': return 'warning';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <OrderDetailsModal
        isOpen={!!selectedOrderDetails}
        onClose={() => setSelectedOrderDetails(null)}
        order={selectedOrderDetails}
        onAssignRider={() => setAssignRiderOrder({ id: detailsOrderId, orderNumber: selectedOrderDetails?.orderNumber || '' })}
        onCancel={() => {
          if (selectedOrderDetails && detailsOrderId) {
            setCancelConfirmData({ orderId: detailsOrderId, orderNumber: selectedOrderDetails.orderNumber });
            setSelectedOrderDetails(null);
          }
        }}
        onEscalate={() => {
          if (selectedOrderDetails && detailsOrderId) {
            escalateOrderMutation.mutate(detailsOrderId);
          }
        }}
        onInitiateRefund={() => {
          if (selectedOrderDetails) {
            setRefundOrderNumber(selectedOrderDetails.orderNumber);
            setSelectedOrderDetails(null);
          }
        }}
      />

      <RefundModal 
        isOpen={!!refundOrderNumber}
        onClose={() => setRefundOrderNumber(null)}
        orderNumber={refundOrderNumber}
        onConfirm={() => {
          if (refundOrderNumber) {
            const dbId = findOrderIdByNumber(refundOrderNumber);
            if (dbId) {
              refundOrderMutation.mutate(dbId);
            } else {
              toast.error("Failed to resolve order ID for refund.");
            }
          }
        }}
      />

      <AssignRiderModal
        isOpen={!!assignRiderOrder}
        onClose={() => setAssignRiderOrder(null)}
        orderNumber={assignRiderOrder?.orderNumber || 'OR-0000'}
        orderId={assignRiderOrder?.id}
      />

      {/* Cancel Order Modal */}
      <CancelOrderModal
        isOpen={!!cancelConfirmData}
        onClose={() => setCancelConfirmData(null)}
        onConfirm={(reason, notes) => {
          if (cancelConfirmData) {
            cancelOrderMutation.mutate({ orderId: cancelConfirmData.orderId, reason, notes });
          }
        }}
        orderNumber={cancelConfirmData?.orderNumber}
        isPending={cancelOrderMutation.isPending}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
        <p className="text-gray-500 mt-1">View and manage all orders</p>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 w-full max-w-xl">
          <Input 
            placeholder="Search by order ID, customer, or restaurant..." 
            className="bg-gray-50 border-none h-11"
            icon={<Search className="h-4 w-4" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative min-w-[140px]">
            <select 
              className="w-full h-11 pl-4 pr-10 bg-gray-50 border-none rounded-lg text-sm font-medium appearance-none cursor-pointer focus:ring-2 focus:ring-primary/20"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="Preparing">Preparing</option>
              <option value="Delivering">Delivering</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Escalated">Escalated</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          <Button 
            variant="outline" 
            className="h-11 border-gray-200 text-gray-700 font-medium px-4"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts[tab.id as keyof typeof counts] || 0;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as OrderStatus)}
              className={cn(
                "flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all min-w-max",
                isActive 
                  ? `${tab.activeBg} ${tab.activeColor} border-b-2 ${tab.activeBorder} rounded-b-none` 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
            >
              <tab.icon className={cn("h-[18px] w-[18px]", isActive ? tab.activeColor : "text-gray-400")} />
              <span>{tab.label}</span>
              {isLoading && !data ? (
                <span className={cn(
                  "ml-1 h-4 w-7 rounded-full animate-pulse inline-block",
                  isActive ? "bg-emerald-200" : "bg-gray-200"
                )} />
              ) : (
                <span className={cn(
                  "ml-1 px-2 py-0.5 rounded-full text-xs",
                  isActive ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow className="hover:bg-transparent border-b border-gray-100">
              <TableHead className="text-gray-900 font-bold py-4">Order ID</TableHead>
              <TableHead className="text-gray-900 font-bold py-4">Date & Time</TableHead>
              <TableHead className="text-gray-900 font-bold py-4">Customer</TableHead>
              <TableHead className="text-gray-900 font-bold py-4">Restaurant</TableHead>
              <TableHead className="text-gray-900 font-bold py-4">Total</TableHead>
              <TableHead className="text-gray-900 font-bold py-4">Status</TableHead>
              <TableHead className="text-gray-900 font-bold py-4">Rider</TableHead>
              <TableHead className="text-gray-900 font-bold py-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-gray-100 rounded w-full"></div></TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length > 0 ? (
              orders.map((order) => (
                <TableRow key={order.orderId} className="hover:bg-gray-50/50 border-b border-gray-50 last:border-0 transition-colors">
                  <TableCell className="font-semibold text-gray-900 py-4">{order.orderNumber}</TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="text-gray-900 text-sm">{format(new Date(order.createdAt), 'MMM d, yyyy')}</span>
                      <span className="text-gray-400 text-xs">{format(new Date(order.createdAt), 'HH:mm')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-700 py-4">{order.customerName}</TableCell>
                  <TableCell className="text-gray-700 py-4">{order.restaurantName}</TableCell>
                  <TableCell className="font-bold text-gray-900 py-4">₹{order.total}</TableCell>
                  <TableCell className="py-4">
                    <Badge variant={getStatusBadgeVariant(order.status)} className="capitalize border px-3">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-700 py-4">{order.riderName || 'Unassigned'}</TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center justify-end gap-3 text-gray-500">
                      <button 
                        onClick={() => {
                          setSelectedOrderDetails({
                            id: order.orderId,
                            orderNumber: order.orderNumber,
                            time: format(new Date(order.createdAt), 'dd/MM/yyyy, HH:mm:ss'),
                            statusType: ['escalated', 'failed', 'cancelled', 'rejected', 'refunded'].includes(order.status.toLowerCase()) ? 'critical' : ['preparing', 'delivering', 'assigned', 'picked_up', 'pickedup', 'ready', 'readyforpickup'].includes(order.status.toLowerCase()) ? 'warning' : 'normal',
                            statusTitle: order.status,
                            statusDescription: "Live tracking & updates enabled",
                            customerName: order.customerName,
                            customerPhone: "+91 88888 12345",
                            customerAddress: "Flat 204, Aundh Society, Pune, MH 411007",
                            customerLatitude: order.latitude,
                            customerLongitude: order.longitude,
                            restaurantName: order.restaurantName,
                            restaurantAddress: "Koregaon Park, Pune, MH 411001",
                            items: [
                              { name: "Sample Menu Item", quantity: 2 },
                              { name: "Extra Add-on", quantity: 1 }
                            ],
                            totalAmount: `₹${order.total}`,
                            timeline: [
                              { status: "Placed", time: format(new Date(order.createdAt), 'HH:mm:ss - dd/MM/yyyy') },
                              { status: order.status, time: format(new Date(), 'HH:mm:ss - dd/MM/yyyy') }
                            ]
                          });
                        }}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="View Order Details"
                      >
                        <Eye className="h-[18px] w-[18px]" />
                      </button>
                      <button 
                        onClick={() => setRefundOrderNumber(order.orderNumber)}
                        className="hover:text-primary transition-colors cursor-pointer p-1"
                        title="Initiate Refund"
                      >
                        <History className="h-[18px] w-[18px]" />
                      </button>
                      <button 
                        onClick={() => {
                          setCancelConfirmData({ orderId: order.orderId, orderNumber: order.orderNumber });
                        }}
                        className="hover:text-red-600 transition-colors cursor-pointer p-1"
                        title="Cancel Order"
                      >
                        <XCircle className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-gray-500">
                  No orders found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
            <div className="text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-900">{(page - 1) * pageSize + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(page * pageSize, totalCount)}</span> of <span className="font-semibold text-gray-900">{totalCount}</span> orders
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="h-9 w-9 p-0 flex items-center justify-center border-gray-200"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {(() => {
                  const totalPages = Math.ceil(totalCount / pageSize);
                  const pages = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    if (page <= 4) {
                      for (let i = 1; i <= 5; i++) pages.push(i);
                      pages.push('...');
                      pages.push(totalPages);
                    } else if (page >= totalPages - 3) {
                      pages.push(1);
                      pages.push('...');
                      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      pages.push('...');
                      pages.push(page - 1);
                      pages.push(page);
                      pages.push(page + 1);
                      pages.push('...');
                      pages.push(totalPages);
                    }
                  }
                  
                  return pages.map((p, i) => (
                    p === '...' ? (
                      <span key={`dots-${i}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <Button
                        key={p}
                        variant={page === p ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setPage(p as number)}
                        className={cn(
                          "h-9 w-9 p-0 text-sm font-medium",
                          page === p ? "bg-primary text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {p}
                      </Button>
                    )
                  ));
                })()}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
                disabled={page >= Math.ceil(totalCount / pageSize)}
                className="h-9 w-9 p-0 flex items-center justify-center border-gray-200"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}



import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Package,
  CheckCircle2,
  Bike,
  IdCard,
  Store,
  Clock,
  X,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { dashboardService } from '@/core/api/dashboard';
import SplashBg from '@/assets/splash_bg.svg';
import AlertResolutionModal, { type AlertData } from '../components/AlertResolutionModal';
import AssignRiderModal from '../components/AssignRiderModal';
import OrderDetailsModal, { type OrderDetailsData } from '../components/OrderDetailsModal';
import RefundModal from '../components/RefundModal';
import { ordersService } from '@/core/api/orders';
import { useAuthStore } from '@/store/authStore';
import { CancelOrderModal } from '@/components/ui/CancelOrderModal';
import { useAlertSound } from '@/core/hooks/useAlertSound';

export default function DashboardPage() {
  const token = useAuthStore(state => state.token);
  const [selectedAlert, setSelectedAlert] = useState<AlertData | null>(null);
  const [assignRiderOrder, setAssignRiderOrder] = useState<{ id?: string; orderNumber: string } | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderDetailsData | null>(null);
  const [refundOrderNumber, setRefundOrderNumber] = useState<string | null>(null);
  const [cancelConfirmData, setCancelConfirmData] = useState<{ orderId: string; orderNumber?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ORDERS_PER_PAGE = 5;

  const detailsOrderId = selectedOrderDetails?.orderId || selectedOrderDetails?.originalOrder?.orderId || selectedOrderDetails?.originalOrder?.id || selectedOrderDetails?.id;

  const queryClient = useQueryClient();

  const cancelOrderMutation = useMutation({
    mutationFn: ({ orderId, reason, notes }: { orderId: string; reason: string; notes: string }) =>
      ordersService.cancelOrder(orderId, { reason, notes, forceCancel: true }),
    onSuccess: () => {
      toast.success(`Order cancelled successfully!`);
      queryClient.invalidateQueries({ queryKey: ['adminLiveOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setCancelConfirmData(null);
      setSelectedAlert(null);
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
      queryClient.invalidateQueries({ queryKey: ['adminLiveOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
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
      queryClient.invalidateQueries({ queryKey: ['adminLiveOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminAlerts'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to escalate order.');
    }
  });

  const findOrderIdByNumber = (num: string) => {
    const cleanNum = num.replace('#', '').trim();
    const match = liveOrders.find((o: any) => 
      o.id.replace('#', '').trim() === cleanNum ||
      o.originalOrder?.orderId === cleanNum ||
      o.originalOrder?.orderNumber === cleanNum
    );
    return match?.originalOrder?.id || match?.originalOrder?.orderId;
  };

  const handleAlertAction = (action: string, data: any) => {
    switch (action) {
      case 'call':
        if (typeof data === 'string') {
          toast.success(`Initiating call to ${data}...`);
          window.open(`tel:${data}`);
        }
        break;
      case 'contact_rider':
      case 'contact_restaurant':
        if (data.phone) {
          toast.success(`Initiating call to ${data.phone}...`);
          window.open(`tel:${data.phone}`);
        } else {
          toast.error(`No phone number available for ${action.replace('_', ' ')}`);
          console.warn('No phone number available for', action);
        }
        break;
      case 'urgent':
        if (data.label?.toLowerCase().includes('assign')) {
          setAssignRiderOrder({ id: resolvedOrderId, orderNumber: selectedAlert?.orderNumber || '' });
        }
        break;
      case 'cancel_order': {
        const orderId = resolvedOrderId;
        if (!orderId) {
          toast.error("Order ID not resolved.");
          break;
        }
        setCancelConfirmData({ orderId, orderNumber: selectedAlert?.orderNumber });
        break;
      }
      case 'refund':
        if (selectedAlert?.orderNumber) {
          setRefundOrderNumber(selectedAlert.orderNumber);
        }
        break;

      default:
        break;
    }
  };

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['adminStats', token],
    queryFn: dashboardService.getStats,
    enabled: !!token,
  });

  const { data: alerts, isLoading: isAlertsLoading } = useQuery({
    queryKey: ['adminAlerts', token],
    queryFn: () => dashboardService.getAlerts(50),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const alertsArray = Array.isArray(alerts) ? alerts : ((alerts as any)?.items || (alerts as any)?.alerts);
  useAlertSound(alertsArray);

  const { data: liveOrdersData, isLoading: isLiveOrdersLoading } = useQuery({
    queryKey: ['adminLiveOrders', token],
    queryFn: () => dashboardService.getLiveOrders(),
    enabled: !!token,
  });

  // Use live stats if available
  const displayStats = {
    activeOrders: stats?.activeOrders ?? 23,
    ordersToday: stats?.todayOrders ?? 147,
    ridersOnline: stats?.onlineRiders ?? 18,
    pendingKyc: stats?.pendingKyc ?? 5,
    activeRestaurants: stats?.activeRestaurants ?? 42
  };

  const displayAlerts = alertsArray ? alertsArray : [
    {
      id: '1',
      type: 'escalated',
      title: 'Order Escalated',
      message: 'Order #OR-8821 is delayed by 18 minutes',
      actionText: 'View Order',
      orderNumber: '#OR-8821',
      customerName: 'Priya Deshmukh',
      restaurantName: 'Pizza Paradise',
      riderName: 'Rohit M.'
    },
    {
      id: '2',
      type: 'failed',
      title: 'Dispatch Failed',
      message: 'Delivery status = Failed for #OR-8804',
      actionText: 'View Order',
      orderNumber: '#OR-8804',
      customerName: 'Amit Singh',
      restaurantName: 'Burger Hub',
      restaurantPhone: '+91 98765 43210'
    },
    {
      id: '3',
      type: 'stuck',
      title: 'Stuck in Dispatch',
      message: 'Order confirmed but no rider assigned for 12 min - #OR-8819',
      actionText: 'View + Manual Assign',
      orderNumber: '#OR-8819',
      customerName: 'Sanjay Gupta',
      restaurantName: 'The Curry House'
    },
    {
      id: '4',
      type: 'awaiting',
      title: 'Awaiting Restaurant Confirmation',
      message: 'Order placed but not yet accepted by the restaurant.',
      actionText: 'Contact Restaurant',
      orderNumber: '#OR-8825',
      customerName: 'Neha Sharma',
      restaurantName: 'Sushi Express',
      restaurantPhone: '+91 88888 77777'
    }
  ];

  const liveOrdersArray = Array.isArray(liveOrdersData) ? liveOrdersData : ((liveOrdersData as any)?.items || (liveOrdersData as any)?.orders);

  const liveOrders = liveOrdersArray ? liveOrdersArray.map((order: any) => ({
    id: order.orderNumber || order.id || 'Unknown',
    time: order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '14:32',
    price: `₹${order.totalAmount || order.total || 0}`,
    delay: order.delayMinutes ? `+${order.delayMinutes}m delay` : null,
    tags: order.tags || [order.status || 'Active'],
    customer: order.customerName || 'Customer',
    items: `${order.totalItems || order.itemCount || 1} items`,
    restaurant: order.restaurantName || 'Restaurant',
    rider: order.riderName || 'Unassigned',
    originalOrder: order
  })) : [
    {
      id: 'OR-8821',
      time: '14:32',
      price: '₹850',
      delay: '+18m delay',
      tags: ['escalated', 'Escalated'],
      customer: 'Priya Deshmukh',
      items: '3 items',
      restaurant: 'Pizza Paradise',
      rider: 'Rohit M.'
    },
    {
      id: 'OR-8820',
      time: '14:35',
      price: '₹560',
      delay: null,
      tags: ['delivering'],
      customer: 'Amit Singh',
      items: '2 items',
      restaurant: 'Burger Hub',
      rider: 'Kavita P.'
    }
  ];

  // Pagination logic
  const totalPages = Math.ceil(liveOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = liveOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE
  );

  const { data: orderDetails } = useQuery({
    queryKey: ['adminOrderDetails', selectedAlert?.orderNumber],
    queryFn: () => {
      const cleanAlertNum = selectedAlert?.orderNumber?.replace('#', '')?.trim();
      const matchingOrder = liveOrders.find((o: any) => 
        o.id.replace('#', '').trim() === cleanAlertNum ||
        o.originalOrder?.orderId === cleanAlertNum ||
        o.originalOrder?.orderNumber === cleanAlertNum
      );
      
      const orderId = matchingOrder?.originalOrder?.id || matchingOrder?.originalOrder?.orderId;
      if (!orderId) throw new Error('Order ID not found');
      return ordersService.getOrderDetails(orderId);
    },
    enabled: !!selectedAlert,
  });

  const enrichedAlert = React.useMemo(() => {
    if (!selectedAlert) return null;
    
    const cleanAlertNum = selectedAlert.orderNumber.replace('#', '').trim();
    
    const matchingOrder = liveOrders.find((o: any) => 
      o.id.replace('#', '').trim() === cleanAlertNum ||
      o.originalOrder?.orderId === cleanAlertNum ||
      o.originalOrder?.orderNumber === cleanAlertNum
    );
    
    const resName = selectedAlert.restaurantName || orderDetails?.restaurantName || (matchingOrder?.restaurant !== 'Restaurant' ? matchingOrder?.restaurant : undefined) || matchingOrder?.originalOrder?.restaurantName;
    const resPhone = selectedAlert.restaurantPhone || (orderDetails as any)?.restaurantPhone || matchingOrder?.originalOrder?.restaurantPhone;
    const rName = selectedAlert.riderName || orderDetails?.riderName || (matchingOrder?.rider !== 'Unassigned' ? matchingOrder?.rider : undefined) || matchingOrder?.originalOrder?.riderName;
    const cName = selectedAlert.customerName || orderDetails?.customerName || (matchingOrder?.customer !== 'Customer' ? matchingOrder?.customer : undefined) || matchingOrder?.originalOrder?.customerName;
    const cPhone = selectedAlert.customerPhone || (orderDetails as any)?.customerPhone || matchingOrder?.originalOrder?.customerPhone;
    
    return {
      ...selectedAlert,
      restaurantName: resName,
      restaurantPhone: resPhone,
      riderName: rName,
      customerName: cName,
      customerPhone: cPhone
    };
  }, [selectedAlert, liveOrders, orderDetails]);

  const resolvedOrderId = React.useMemo(() => {
    if (!selectedAlert?.orderNumber) return undefined;
    const cleanAlertNum = selectedAlert.orderNumber.replace('#', '').trim();
    const matchingOrder = liveOrders.find((o: any) => 
      o.id.replace('#', '').trim() === cleanAlertNum ||
      o.originalOrder?.orderId === cleanAlertNum ||
      o.originalOrder?.orderNumber === cleanAlertNum
    );
    return matchingOrder?.originalOrder?.id || matchingOrder?.originalOrder?.orderId;
  }, [selectedAlert, liveOrders]);

  return (
    <div className="w-full">
      <AlertResolutionModal
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        alert={enrichedAlert}
        onAction={handleAlertAction}
        onAssignRider={() => setAssignRiderOrder({ id: resolvedOrderId, orderNumber: selectedAlert?.orderNumber || '' })}
      />

      <AssignRiderModal
        isOpen={!!assignRiderOrder}
        onClose={() => setAssignRiderOrder(null)}
        orderNumber={assignRiderOrder?.orderNumber || 'OR-0000'}
        orderId={assignRiderOrder?.id}
      />

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">Live Operations</h1>
          <p className="text-[13px] text-gray-500 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {new Date().toLocaleTimeString('en-US', { hour12: false })} • Real-time monitoring
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          Live
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        {isStatsLoading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard title="Active Orders" value={displayStats.activeOrders} icon={<Package className="w-[18px] h-[18px]" />} />
            <KpiCard title="Orders Today" value={displayStats.ordersToday} icon={<CheckCircle2 className="w-[18px] h-[18px]" />} />
            <KpiCard title="Riders Online" value={displayStats.ridersOnline} icon={<Bike className="w-[18px] h-[18px]" />} />
            <KpiCard title="Pending KYC" value={displayStats.pendingKyc} icon={<IdCard className="w-[18px] h-[18px]" />} />
            <KpiCard title="Active Restaurants" value={displayStats.activeRestaurants} icon={<Store className="w-[18px] h-[18px]" />} />
          </>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Alerts */}
        <div>
          <div className="mb-4">
            <h2 className="text-[17px] font-bold text-gray-900">Alerts</h2>
            <p className="text-[13px] text-[#d72b1f] font-medium mt-0.5">{displayAlerts.length} active alerts</p>
          </div>

          <div className="space-y-4">
            {isAlertsLoading ? (
              <>
                <AlertSkeleton />
                <AlertSkeleton />
                <AlertSkeleton />
              </>
            ) : displayAlerts.length > 0 ? displayAlerts.map((alert: any) => (
              <div
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`relative rounded-2xl p-5 border shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${alert.type === 'stuck' ? 'bg-[#fffdf5] border-orange-100' :
                    alert.type === 'awaiting' ? 'bg-[#fff5eb] border-orange-200' :
                      alert.type === 'pending_kyc' ? 'bg-[#f5f3ff] border-purple-100' :
                        'bg-[#fff5f5] border-red-50'
                  }`}
              >
                {/* Splash background */}
                <img
                  src={SplashBg}
                  alt=""
                  className="absolute bottom-0 left-0 w-6 h-6 object-contain opacity-40 pointer-events-none"
                />

                <button
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="relative z-10">
                  <h3 className={`font-bold text-[15px] mb-1 ${alert.type === 'stuck' || alert.type === 'awaiting' ? 'text-orange-700' :
                      alert.type === 'pending_kyc' ? 'text-purple-700' :
                        'text-[#d72b1f]'
                    }`}>
                    {alert.title}
                  </h3>
                  <p className={`text-[13px] mb-4 ${alert.type === 'stuck' || alert.type === 'awaiting' ? 'text-orange-800/80' :
                      alert.type === 'pending_kyc' ? 'text-purple-800/80' :
                        'text-[#d72b1f]/80'
                    }`}>
                    {alert.message}
                  </p>
                  <button className={`px-4 py-1.5 rounded-full text-[13px] font-semibold bg-white shadow-sm border ${alert.type === 'stuck' || alert.type === 'awaiting' ? 'border-orange-200 text-orange-700 hover:bg-orange-50' :
                      alert.type === 'pending_kyc' ? 'border-purple-200 text-purple-700 hover:bg-purple-50' :
                        'border-red-100 text-[#d72b1f] hover:bg-red-50'
                    }`}>
                    {alert.actionText || (
                      alert.message?.toLowerCase().includes('confirm') || alert.title?.toLowerCase().includes('confirm')
                        ? 'Contact Restaurant'
                        : 'Resolve'
                    )}
                  </button>
                </div>
              </div>
            )) : (
              <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl p-10 text-center">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">All Systems Normal</h3>
                <p className="text-[13px] text-gray-500 max-w-[200px] mx-auto">No active alerts requiring your attention right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Live Order Feed */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[17px] font-bold text-gray-900">Live Order Feed</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">Real-time order updates</p>
            </div>
            <div className="px-2.5 py-1 rounded-full border bg-white text-[11px] font-semibold text-gray-600">
              {liveOrders.length} Active
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm divide-y">
            {isLiveOrdersLoading ? (
              <>
                <LiveOrderSkeleton />
                <LiveOrderSkeleton />
                <LiveOrderSkeleton />
              </>
            ) : paginatedOrders.length > 0 ? (
              paginatedOrders.map((order: any) => (
                <div key={order.id} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[15px] text-gray-900">{order.id}</h3>
                        <button
                          onClick={() => {
                            const og = order.originalOrder || {};
                            setSelectedOrderDetails({
                              id: order.id,
                              orderId: og.orderId,
                              originalOrder: og,
                              orderNumber: order.id,
                              time: og.createdAt ? new Date(og.createdAt).toLocaleString() : new Date().toLocaleString(),
                              statusType: og.isEscalated || og.status === 'Failed' ? 'critical' : 'warning',
                              statusTitle: og.status || 'Active',
                              statusDescription: og.delayMinutes ? `Delayed by ${og.delayMinutes} minutes` : 'Order processing',
                              customerName: order.customer,
                              customerPhone: og.customerPhone || "+91 88888 12345",
                              customerAddress: og.customerAddress || "Address details not provided by API",
                              restaurantName: order.restaurant,
                              restaurantAddress: og.restaurantAddress || "Address details not provided by API",
                              items: og.items || Array.from({ length: og.itemCount || og.totalItems || 1 }).map((_, i) => ({
                                name: `Item ${i + 1}`,
                                quantity: 1
                              })),
                              totalAmount: order.price,
                              timeline: og.timeline || [
                                { status: "Placed", time: og.createdAt ? new Date(og.createdAt).toLocaleString() : new Date().toLocaleString() }
                              ]
                            });
                          }}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[12px] text-gray-500 mt-0.5">{order.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[15px] text-gray-900">{order.price}</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">{order.time}</p>
                      {order.delay && <p className="text-[12px] font-semibold text-[#d72b1f] mt-0.5">{order.delay}</p>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {order.tags.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${tag.toLowerCase() === 'escalated'
                            ? 'bg-[#fff5f5] text-[#d72b1f] border-red-100'
                            : tag.toLowerCase() === 'refunding'
                              ? 'bg-orange-50 text-orange-700 border-orange-100'
                              : 'bg-green-50 text-green-700 border-green-100'
                          }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-gray-900">{order.customer}</span>
                      <span className="text-gray-500">{order.items}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-gray-600">{order.restaurant}</span>
                      <span className="font-medium text-green-600">{order.rider}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center">
                <p className="text-gray-500 text-sm">No live orders at the moment.</p>
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          {!isLiveOrdersLoading && totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t border-gray-100">
              <p className="text-[12px] text-gray-500 font-medium">
                Showing <span className="font-bold text-gray-900">{Math.min(liveOrders.length, (currentPage - 1) * ORDERS_PER_PAGE + 1)}</span> to <span className="font-bold text-gray-900">{Math.min(liveOrders.length, currentPage * ORDERS_PER_PAGE)}</span> of <span className="font-bold text-gray-900">{liveOrders.length}</span> orders
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:border-gray-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-1">
                  {/* Smart Pagination Logic */}
                  {(() => {
                    const pages = [];
                    const maxVisible = 5;
                    
                    if (totalPages <= maxVisible + 2) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (currentPage > 3) pages.push('...');
                      
                      const start = Math.max(2, currentPage - 1);
                      const end = Math.min(totalPages - 1, currentPage + 1);
                      
                      if (currentPage <= 3) {
                        for (let i = 2; i <= 4; i++) pages.push(i);
                        pages.push('...');
                      } else if (currentPage >= totalPages - 2) {
                        pages.push('...');
                        for (let i = totalPages - 3; i <= totalPages - 1; i++) pages.push(i);
                      } else {
                        for (let i = start; i <= end; i++) pages.push(i);
                        pages.push('...');
                      }
                      pages.push(totalPages);
                    }
                    
                    return pages.map((page, idx) => (
                      <button
                        key={idx}
                        onClick={() => typeof page === 'number' && setCurrentPage(page)}
                        disabled={page === '...'}
                        className={cn(
                          "w-9 h-9 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center",
                          currentPage === page
                            ? "bg-gray-900 text-white shadow-lg shadow-gray-200 scale-105"
                            : page === '...'
                              ? "text-gray-400 cursor-default"
                              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        )}
                      >
                        {page}
                      </button>
                    ));
                  })()}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:border-gray-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col relative overflow-hidden group">
      <div className="text-[13px] font-semibold text-gray-500 mb-2">{title}</div>
      <div className="text-[32px] font-bold text-gray-900 leading-none tracking-tight">{value}</div>
      <div className="absolute top-5 right-5 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        {icon}
      </div>
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col relative overflow-hidden animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
      <div className="h-8 bg-gray-200 rounded w-16 mt-1"></div>
      <div className="absolute top-5 right-5 w-10 h-10 rounded-full bg-gray-100"></div>
    </div>
  );
}

function AlertSkeleton() {
  return (
    <div className="relative rounded-2xl p-5 border shadow-sm overflow-hidden bg-gray-50/50 animate-pulse">
      <div className="w-6 h-6 absolute bottom-0 left-0 bg-gray-200 opacity-40 rounded-tr-xl"></div>
      <div className="w-4 h-4 absolute top-4 right-4 bg-gray-200 rounded-full"></div>
      <div className="relative z-10">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-5"></div>
        <div className="h-7 bg-gray-200 rounded-full w-28"></div>
      </div>
    </div>
  );
}

function LiveOrderSkeleton() {
  return (
    <div className="p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-12"></div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-12"></div>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="h-5 bg-gray-200 rounded-full w-16"></div>
        <div className="h-5 bg-gray-200 rounded-full w-20"></div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-3 bg-gray-200 rounded w-24"></div>
          <div className="h-3 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="flex items-center justify-between">
          <div className="h-3 bg-gray-200 rounded w-32"></div>
          <div className="h-3 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { API_URL } from '@/core/api/axios';
import toast from 'react-hot-toast';

import { playNotificationSound } from '@/utils/sound';

export function useAdminSignalR() {
  const queryClient = useQueryClient();
  const token = useAuthStore(state => state.token);
  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    if (!token) return;

    const hubUrl = `${API_URL}/hubs/notifications`.replace('/api/hubs', '/hubs');

    const conn = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connectionRef.current = conn;

    // 1. OrderEscalated
    conn.on("OrderEscalated", (data) => {
      toast.error(`Order Escalated: ${data?.orderId || 'Unknown'}`);
      playNotificationSound();
      queryClient.invalidateQueries({ queryKey: ['adminAlerts'] });
    });

    // 2. AdminOrderFeed
    conn.on("AdminOrderFeed", (msg) => {
      const { event, payload } = msg;

      // Update adminStats
      queryClient.setQueryData(['adminStats'], (old: any) => {
        if (!old) return old;
        const newState = { ...old };
        if (event === "OrderPlaced") {
          newState.activeOrders = (newState.activeOrders || 0) + 1;
          newState.todayOrders = (newState.todayOrders || 0) + 1;
        } else if (["Delivered", "Failed", "Cancelled", "Rejected"].includes(event)) {
          newState.activeOrders = Math.max(0, (newState.activeOrders || 0) - 1);
        }
        return newState;
      });

      // Update adminLiveOrders table
      queryClient.setQueryData(['adminLiveOrders'], (old: any) => {
        const currentOrders = Array.isArray(old) ? old : (old?.items || old?.orders || []);
        let newOrders = [...currentOrders];

        if (event === "OrderPlaced") {
          newOrders = [payload, ...newOrders];
        } else {
          newOrders = newOrders.map((o: any) => {
            const id = o.orderId || o.orderNumber || o.id;
            const payloadId = payload.orderId || payload.orderNumber || payload.id;
            if (id === payloadId) {
              return { ...o, ...payload };
            }
            return o;
          });
        }
        
        if (Array.isArray(old)) return newOrders;
        if (old?.items) return { ...old, items: newOrders };
        if (old?.orders) return { ...old, orders: newOrders };
        return newOrders;
      });
    });

    // 3. AdminRiderFeed
    conn.on("AdminRiderFeed", (msg) => {
      const { event, payload } = msg;

      // Update adminStats
      queryClient.setQueryData(['adminStats'], (old: any) => {
        if (!old) return old;
        const newState = { ...old };
        if (event === "RiderOnline") {
          newState.onlineRiders = (newState.onlineRiders || 0) + 1;
        } else if (event === "RiderOffline") {
          newState.onlineRiders = Math.max(0, (newState.onlineRiders || 0) - 1);
        } else if (event === "KycSubmitted") {
          newState.pendingKyc = (newState.pendingKyc || 0) + 1;
        }
        return newState;
      });

      // Toast rule
      if (payload?.showToast) {
        // Specifically handling KycSubmitted visually, though the generic toast works too
        toast.success(
          event === "KycSubmitted" 
            ? `New KYC Submitted: ${payload.name || 'Rider'}` 
            : `Rider Update: ${payload.name || 'Rider'}`
        );
      }
    });

    conn.start().catch(err => {
      if (err.name === 'AbortError' || err.message.includes('stopped during negotiation')) {
        console.log("SignalR Connection aborted (expected in React Strict Mode dev environment).");
      } else {
        console.error("SignalR Connection Error: ", err);
      }
    });

    return () => {
      conn.stop();
    };
  }, [token, queryClient]);
}

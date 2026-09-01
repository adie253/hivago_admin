import { useEffect, useRef } from 'react';
import { playNotificationSound } from '@/utils/sound';

/**
 * Custom hook to play a notification sound when new operational alerts arrive from GET /api/admin/alerts.
 */
export function useAlertSound(alerts: any[] | undefined) {
  const previousAlertIds = useRef<Set<string>>(new Set());
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    if (!alerts || !Array.isArray(alerts)) return;

    const currentIds = new Set<string>();
    let hasNewAlerts = false;

    alerts.forEach((alert: any) => {
      const id = String(alert.id || alert.alertId || alert.orderNumber || JSON.stringify(alert));
      currentIds.add(id);

      // If an alert ID is encountered that was not present previously
      if (!isInitialMount.current && !previousAlertIds.current.has(id)) {
        hasNewAlerts = true;
      }
    });

    if (hasNewAlerts) {
      playNotificationSound();
    }

    previousAlertIds.current = currentIds;
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [alerts]);
}

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Volume2, VolumeX, Bell, Play, AlertTriangle, CheckCircle, RefreshCw, X } from 'lucide-react';
import { dashboardService } from '@/core/api/dashboard';
import { useAuthStore } from '@/store/authStore';
import { isSoundEnabled, toggleSound, testNotificationSound } from '@/utils/sound';

interface NotificationDropdownProps {
  onClose: () => void;
  onSelectAlert?: (alert: any) => void;
}

export function NotificationDropdown({ onClose, onSelectAlert }: NotificationDropdownProps) {
  const token = useAuthStore(state => state.token);
  const [soundActive, setSoundActive] = useState<boolean>(isSoundEnabled());

  const { data: alerts, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['adminAlerts', token],
    queryFn: () => dashboardService.getAlerts(50),
    enabled: !!token,
  });

  const handleToggleSound = () => {
    const nextState = toggleSound();
    setSoundActive(nextState);
  };

  const handleTestSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    testNotificationSound();
  };

  const alertsList = Array.isArray(alerts)
    ? alerts
    : (alerts as any)?.items || (alerts as any)?.alerts || [];

  return (
    <div className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-white shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-red-400" />
          <span className="font-semibold text-sm">Operational Alerts</span>
          {alertsList.length > 0 && (
            <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {alertsList.length}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded transition-colors"
            title="Refresh alerts"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sound Settings Control Strip */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSound}
            className={`flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-md transition-colors ${
              soundActive
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {soundActive ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Sound On</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-gray-500" />
                <span>Sound Muted</span>
              </>
            )}
          </button>
        </div>

        <button
          onClick={handleTestSound}
          className="flex items-center gap-1 font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors"
          title="Play notification sound test"
        >
          <Play className="h-3 w-3 fill-current" />
          <span>Test Chime</span>
        </button>
      </div>

      {/* Alerts List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-gray-400">Loading alerts...</div>
        ) : alertsList.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-gray-700">All Clear</p>
            <p className="text-xs text-gray-500 mt-0.5">No active operational alerts requiring attention.</p>
          </div>
        ) : (
          alertsList.map((alert: any, idx: number) => {
            const isEscalated = alert.type === 'escalated' || alert.severity === 'high';
            return (
              <div
                key={alert.id || idx}
                onClick={() => {
                  if (onSelectAlert) onSelectAlert(alert);
                  onClose();
                }}
                className="p-3.5 hover:bg-red-50/40 transition-colors cursor-pointer group relative"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      isEscalated ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-xs text-gray-900 truncate">
                        {alert.title || alert.type || 'Alert'}
                      </span>
                      {alert.orderNumber && (
                        <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                          {alert.orderNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                      {alert.message || alert.description || 'Action required.'}
                    </p>
                    {alert.actionText && (
                      <span className="inline-block text-[11px] font-semibold text-red-600 group-hover:underline mt-1.5">
                        {alert.actionText} →
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 bg-gray-50 border-t border-gray-100 text-center">
        <span className="text-[11px] text-gray-500">
          Auto-syncing every 15s • Sound plays on new operational alerts
        </span>
      </div>
    </div>
  );
}

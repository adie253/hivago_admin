import { useState, useRef, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import hivago_logo from '../assets/hivago_logo.svg';
import { dashboardService } from '@/core/api/dashboard';
import { NotificationDropdown } from '@/components/NotificationDropdown';

export function TopNav() {
  const { logout, token } = useAuthStore();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const { data: alerts } = useQuery({
    queryKey: ['adminAlerts', token],
    queryFn: () => dashboardService.getAlerts(50),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const alertsList = Array.isArray(alerts)
    ? alerts
    : (alerts as any)?.items || (alerts as any)?.alerts || [];
  const alertCount = alertsList.length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex h-16 shrink-0 items-center justify-between bg-[#d72b1f] px-6 shadow-md z-50 relative">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
        <img src={hivago_logo} alt="Hivago Admin" />
      </div>

      <div className="flex items-center gap-x-4 relative" ref={navRef}>
        {/* Notification Bell */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          type="button"
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors relative"
          title="View operational alerts"
        >
          <span className="sr-only">View notifications</span>
          <Bell className="h-[20px] w-[20px]" aria-hidden="true" />
          {alertCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-gray-900 shadow">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          ) : (
            <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-emerald-400 border border-[#d72b1f]"></span>
          )}
        </button>

        {showNotifications && (
          <NotificationDropdown
            onClose={() => setShowNotifications(false)}
            onSelectAlert={() => navigate('/')}
          />
        )}

        <button
          onClick={handleLogout}
          type="button"
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center"
          title="Log out"
        >
          <span className="sr-only">Log out</span>
          <LogOut className="h-[20px] w-[20px]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

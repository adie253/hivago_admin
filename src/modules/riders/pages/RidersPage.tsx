import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Eye, Loader2, Users, Plus, Unlock } from 'lucide-react';
import { riderService, type AdminRider } from '@/core/api/riders';
import { useDebounce } from '@/hooks/useDebounce';
import toast from 'react-hot-toast';
import RiderKycModal from '../components/RiderKycModal';
import AddRiderModal from '../components/AddRiderModal';
import { Button } from '@/components/ui/Button';
import { CustomConfirmModal } from '@/components/ui/CustomPopups';

function kycBadge(status: AdminRider['kycStatus']) {
  switch (status) {
    case 'Verified':
      return (
        <span className="inline-flex px-2.5 py-1 bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] rounded-full text-[12px] font-semibold">
          Verified
        </span>
      );
    case 'Rejected':
      return (
        <span className="inline-flex px-2.5 py-1 bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] rounded-full text-[12px] font-semibold">
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex px-2.5 py-1 bg-[#fff7ed] text-[#ea580c] border border-[#fed7aa] rounded-full text-[12px] font-semibold">
          Pending
        </span>
      );
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function RidersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [kycFilter, setKycFilter] = useState('');
  const [selectedRider, setSelectedRider] = useState<AdminRider | null>(null);
  const [isAddRiderOpen, setIsAddRiderOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{ riderId: string; riderName: string } | null>(null);

  const queryClient = useQueryClient();

  const releaseDeliveryMutation = useMutation({
    mutationFn: (riderId: string) => riderService.releaseDelivery(riderId),
    onSuccess: () => {
      toast.success("Rider's stuck delivery cleared successfully!");
      queryClient.invalidateQueries({ queryKey: ['riders'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to release delivery.");
    }
  });

  const debouncedSearch = useDebounce(searchTerm.trim(), 300);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['riders', debouncedSearch, statusFilter, kycFilter],
    queryFn: () =>
      riderService.getRiders({
        isOnline: statusFilter === 'all' ? undefined : statusFilter === 'online',
        kycStatus: kycFilter || undefined,
      }),
    refetchInterval: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const riders = data?.riders ?? [];
  const totalCount = data?.totalCount ?? 0;

  // Client-side name search (API may not support search param)
  const filtered = debouncedSearch
    ? riders.filter(
        (r) =>
          r.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          r.phone.includes(debouncedSearch)
      )
    : riders;

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Rider Management</h1>
          <p className="text-[14px] text-gray-500 mt-1">Manage delivery riders and KYC verification</p>
        </div>
        <Button
          onClick={() => setIsAddRiderOpen(true)}
          className="flex items-center gap-1.5 bg-[#d72b1f] hover:bg-[#b82218] text-white font-semibold shadow-sm rounded-lg"
        >
          <Plus className="w-4.5 h-4.5" />
          Add Rider
        </Button>
      </div>

      <div className="bg-white rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50/80 border border-gray-100 rounded-lg text-[13px] placeholder:text-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#d72b1f]/20 focus:border-[#d72b1f] transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-gray-50/80 border border-gray-100 text-gray-700 text-[13px] rounded-lg focus:ring-2 focus:ring-[#d72b1f]/20 focus:border-[#d72b1f] focus:bg-white px-3 py-2.5 outline-none appearance-none w-full sm:w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
            <select
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
              className="bg-gray-50/80 border border-gray-100 text-gray-700 text-[13px] rounded-lg focus:ring-2 focus:ring-[#d72b1f]/20 focus:border-[#d72b1f] focus:bg-white px-3 py-2.5 outline-none appearance-none w-full sm:w-[150px]"
            >
              <option value="">All KYC</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
              <option value="Rejected">Rejected</option>
            </select>
            {!isLoading && (
              <span className="shrink-0 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-[12px] font-semibold text-gray-600 whitespace-nowrap">
                {totalCount} Riders
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="text-[12px] font-semibold text-gray-900 bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-6 py-4">Rider</th>
                <th scope="col" className="px-6 py-4">Phone</th>
                <th scope="col" className="px-6 py-4">Vehicle</th>
                <th scope="col" className="px-6 py-4">Online</th>
                <th scope="col" className="px-6 py-4">Active</th>
                <th scope="col" className="px-6 py-4">KYC Status</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-[13px]">Loading riders...</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-[13px] text-red-500">
                    Failed to load riders. Please try again.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Users className="w-8 h-8 opacity-40" />
                      <span className="text-[13px]">No riders found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((rider) => (
                  <tr key={rider.id} className="bg-white hover:bg-gray-50/50 transition-colors">
                    {/* Rider */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-[38px] h-[38px] rounded-full bg-[#1a1a1a] text-white flex items-center justify-center font-semibold text-[13px] shrink-0">
                          {getInitials(rider.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{rider.name}</div>
                          <div className="text-gray-400 text-[11px] mt-0.5 font-mono">
                            {rider.id.slice(0, 8).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 text-gray-700 font-medium">{rider.phone}</td>

                    {/* Vehicle */}
                    <td className="px-6 py-4 text-gray-600">{rider.vehicleType}</td>

                    {/* Online */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            rider.isOnline ? 'bg-[#10b981]' : 'bg-gray-300'
                          }`}
                        />
                        <span className="text-gray-700">{rider.isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </td>

                    {/* Active */}
                    <td className="px-6 py-4">
                      {rider.isActive ? (
                        <span className="inline-flex px-2.5 py-1 bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] rounded-full text-[12px] font-semibold">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 bg-gray-100 text-gray-500 border border-gray-200 rounded-full text-[12px] font-semibold">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* KYC Status */}
                    <td className="px-6 py-4">{kycBadge(rider.kycStatus)}</td>

                    {/* Action */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedRider(rider)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          title="View KYC & Bank Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmModalData({ riderId: rider.id, riderName: rider.name });
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Release Stuck Delivery"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* KYC Modal */}
      {selectedRider && (
        <RiderKycModal rider={selectedRider} onClose={() => setSelectedRider(null)} />
      )}

      {/* Add Rider Modal */}
      <AddRiderModal isOpen={isAddRiderOpen} onClose={() => setIsAddRiderOpen(false)} />

      {/* Stuck Delivery Release Confirmation Modal */}
      <CustomConfirmModal
        isOpen={!!confirmModalData}
        onClose={() => setConfirmModalData(null)}
        onConfirm={() => {
          if (confirmModalData) {
            releaseDeliveryMutation.mutate(confirmModalData.riderId);
          }
        }}
        title="Release Stuck Delivery"
        message={`Are you sure you want to force-clear any stuck delivery for ${confirmModalData?.riderName}?`}
        confirmText="Release"
        isDestructive={true}
      />
    </div>
  );
}

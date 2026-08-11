import { useState, useEffect, useRef } from 'react';
import { X, Search, Check, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { restaurantService, type CreateRestaurantPayload } from '@/core/api/restaurants';
import { ownerService, type AdminOwner } from '@/core/api/owners';
import { Button } from '@/components/ui/Button';

interface AddRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const addRestaurantSchema = z.object({
  ownerId: z.string().min(1, 'Owner selection is mandatory'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone must be at least 10 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  addressLine: z.string().min(5, 'Address is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bankAccountName: z.string().min(1, 'Bank Account Name is required'),
  bankAccountNumber: z.string().min(1, 'Bank Account Number is required'),
  bankIfscCode: z.string().min(1, 'IFSC Code is required').refine(val => val.length === 11, 'IFSC Code must be exactly 11 characters'),
});

export function AddRestaurantModal({ isOpen, onClose }: AddRestaurantModalProps) {
  const queryClient = useQueryClient();
  const ownerDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<CreateRestaurantPayload>({
    ownerId: '',
    name: '',
    phone: '',
    email: '',
    password: '',
    addressLine: '',
    latitude: 0,
    longitude: 0,
  });

  const [bankData, setBankData] = useState({
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfscCode: '',
  });

  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [debouncedOwnerQuery, setDebouncedOwnerQuery] = useState('');
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<AdminOwner | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOwnerQuery(ownerSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [ownerSearchQuery]);

  const { data: ownersData, isLoading: isSearchingOwners } = useQuery({
    queryKey: ['ownersSearch', debouncedOwnerQuery],
    queryFn: async () => {
      const res = await ownerService.getOwners({ pageSize: 100 });
      if (debouncedOwnerQuery && res?.owners) {
        const lowerQ = debouncedOwnerQuery.toLowerCase();
        return {
          ...res,
          owners: res.owners.filter(o => 
            o.name.toLowerCase().includes(lowerQ) || 
            o.email.toLowerCase().includes(lowerQ) || 
            o.id.toLowerCase().includes(lowerQ)
          )
        };
      }
      return res;
    },
    enabled: isOwnerDropdownOpen,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(event.target as Node)) {
        setIsOwnerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mutation = useMutation({
    mutationFn: (payload: CreateRestaurantPayload) => restaurantService.createRestaurant(payload),
    onSuccess: () => {
      toast.success('Restaurant created successfully!');
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      onClose();
      setFormData({
        ownerId: '', name: '', phone: '', email: '', password: '', addressLine: '', 
        latitude: 0, longitude: 0
      });
      setBankData({
        bankAccountName: '',
        bankAccountNumber: '',
        bankIfscCode: '',
      });
      setLatInput('');
      setLngInput('');
      setSelectedOwner(null);
      setOwnerSearchQuery('');
      setErrorMsg('');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Failed to create restaurant. Please try again.';
      setErrorMsg(msg);
      toast.error(msg);
    }
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const parsedLat = latInput.trim() === '' ? 0 : parseFloat(latInput);
      const parsedLng = lngInput.trim() === '' ? 0 : parseFloat(lngInput);
      const payload: CreateRestaurantPayload = {
        ...formData,
        latitude: isNaN(parsedLat) ? 0 : parsedLat,
        longitude: isNaN(parsedLng) ? 0 : parsedLng,
      };

      addRestaurantSchema.parse({ ...payload, ...bankData });
      
      // Update owner's bank details first to ensure banking info is attached
      await ownerService.updateBankDetails(formData.ownerId, {
        bankAccountName: bankData.bankAccountName.trim(),
        bankAccountNumber: bankData.bankAccountNumber.trim(),
        bankIfscCode: bankData.bankIfscCode.trim().toUpperCase(),
      });

      mutation.mutate(payload);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const msg = err.issues?.[0]?.message || 'Validation error. Please check your inputs.';
        setErrorMsg(msg);
        toast.error(msg);
      } else {
        const msg = err?.response?.data?.message || err?.message || 'Failed to update owner bank details.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'bankAccountName' || name === 'bankAccountNumber' || name === 'bankIfscCode') {
      setBankData(prev => ({ ...prev, [name]: value }));
      return;
    }

    if (name === 'latitude') {
      setLatInput(value);
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        setFormData(prev => ({ ...prev, latitude: parsed }));
      }
      return;
    }
    if (name === 'longitude') {
      setLngInput(value);
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        setFormData(prev => ({ ...prev, longitude: parsed }));
      }
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Add New Restaurant</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium text-center">
              {errorMsg}
            </div>
          )}

          <form id="add-restaurant-form" onSubmit={handleSubmit} className="space-y-5">
            
            <div className="space-y-1.5 relative" ref={ownerDropdownRef}>
              <label className="text-[13px] font-semibold text-gray-700">Assign Owner <span className="text-red-500">*</span></label>
              
              {!selectedOwner ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={ownerSearchQuery}
                    onChange={(e) => {
                      setOwnerSearchQuery(e.target.value);
                      setIsOwnerDropdownOpen(true);
                    }}
                    onFocus={() => setIsOwnerDropdownOpen(true)}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400"
                    placeholder="Search owner by name, email, or ID..."
                  />
                  {isSearchingOwners && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2.5 border border-primary/30 bg-primary/5 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">{selectedOwner.name}</span>
                    <span className="text-xs text-gray-500">{selectedOwner.email} • ID: {selectedOwner.id.substring(0, 8)}...</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOwner(null);
                      setFormData(prev => ({ ...prev, ownerId: '' }));
                      setBankData({ bankAccountName: '', bankAccountNumber: '', bankIfscCode: '' });
                      setOwnerSearchQuery('');
                      setTimeout(() => setIsOwnerDropdownOpen(true), 100);
                    }}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors"
                  >
                    Change
                  </button>
                </div>
              )}

              {isOwnerDropdownOpen && !selectedOwner && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                  {ownersData?.owners && ownersData.owners.length > 0 ? (
                    <ul className="py-1">
                      {ownersData.owners.map(owner => (
                        <li key={owner.id}>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-3 transition-colors"
                            onClick={() => {
                              setSelectedOwner(owner);
                              setFormData(prev => ({ ...prev, ownerId: owner.id }));
                              setBankData({
                                bankAccountName: owner.bankAccountName || '',
                                bankAccountNumber: owner.bankAccountNumber || '',
                                bankIfscCode: owner.bankIfscCode || '',
                              });
                              setIsOwnerDropdownOpen(false);
                              setErrorMsg('');
                            }}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {owner.name.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate">{owner.name}</span>
                              <span className="text-xs text-gray-500 truncate">{owner.email}</span>
                            </div>
                            {formData.ownerId === owner.id && (
                              <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500 flex flex-col items-center">
                      <AlertCircle className="w-5 h-5 text-gray-400 mb-1.5" />
                      {ownerSearchQuery.length > 0 ? "No owners found matching your search." : "Type to search for an owner."}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-5 mt-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Restaurant Name <span className="text-red-500">*</span></label>
                <input 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" 
                  placeholder="Enter restaurant name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Contact Number <span className="text-red-500">*</span></label>
                <input 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" 
                  placeholder="+91 98765 00000"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-gray-700">Email Address <span className="text-red-500">*</span></label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" 
                placeholder="contact@restaurant.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-gray-700">Initial Password <span className="text-red-500">*</span></label>
              <input 
                type="password" 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" 
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-gray-700">Address <span className="text-red-500">*</span></label>
              <input 
                name="addressLine" 
                value={formData.addressLine} 
                onChange={handleChange} 
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" 
                placeholder="Full restaurant address"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Latitude</label>
                <input 
                  type="text" name="latitude" 
                  value={latInput} onChange={handleChange} 
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors" 
                  placeholder="0.0000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Longitude</label>
                <input 
                  type="text" name="longitude" 
                  value={lngInput} onChange={handleChange} 
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors" 
                  placeholder="0.0000"
                />
              </div>
            </div>

            {/* Banking Details */}
            <div className="pt-4 mt-2 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Banking & Payout Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[13px] font-semibold text-gray-700">Bank Account Name <span className="text-red-500">*</span></label>
                  <input 
                    name="bankAccountName" 
                    value={bankData.bankAccountName} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" 
                    placeholder="Name as per bank records" 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">Account Number <span className="text-red-500">*</span></label>
                  <input 
                    name="bankAccountNumber" 
                    value={bankData.bankAccountNumber} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" 
                    placeholder="Account Number" 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">IFSC Code <span className="text-red-500">*</span></label>
                  <input 
                    name="bankIfscCode" 
                    value={bankData.bankIfscCode} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400 uppercase" 
                    placeholder="IFSC Code" 
                    required 
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[13px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <Button 
            type="submit" 
            form="add-restaurant-form"
            className="px-6 py-2 text-[13px] font-semibold bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg shadow-sm"
            isLoading={mutation.isPending}
          >
            Add Restaurant
          </Button>
        </div>

      </div>
    </div>
  );
}

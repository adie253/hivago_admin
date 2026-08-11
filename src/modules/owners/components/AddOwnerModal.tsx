import { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { ownerService, type CreateOwnerPayload } from '@/core/api/owners';
import { Button } from '@/components/ui/Button';

interface AddOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const addOwnerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name cannot exceed 255 characters'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  panNumber: z.string().optional().refine(val => !val || val.length === 10, 'PAN must be exactly 10 characters'),
  gstNumber: z.string().optional().refine(val => !val || val.length === 15, 'GST must be exactly 15 characters'),
  bankAccountName: z.string().min(1, 'Bank Account Name is required'),
  bankAccountNumber: z.string().min(1, 'Bank Account Number is required'),
  bankIfscCode: z.string().min(1, 'IFSC Code is required').refine(val => val.length === 11, 'IFSC Code must be exactly 11 characters'),
});

export function AddOwnerModal({ isOpen, onClose }: AddOwnerModalProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateOwnerPayload>({
    name: '',
    phone: '',
    email: '',
    password: '',
    panNumber: '',
    gstNumber: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    bankAccountName: '',
  });

  const [errorMsg, setErrorMsg] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: CreateOwnerPayload) => ownerService.createOwner(payload),
    onSuccess: () => {
      toast.success('Owner created successfully!');
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      // Invalidate the search cache if necessary
      queryClient.invalidateQueries({ queryKey: ['ownersSearch'] });
      onClose();
      // Reset form
      setFormData({
        name: '', phone: '', email: '', password: '', 
        panNumber: '', gstNumber: '', bankAccountNumber: '', bankIfscCode: '', bankAccountName: ''
      });
      setErrorMsg('');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Failed to create owner. Please try again.';
      setErrorMsg(msg);
      toast.error(msg);
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      addOwnerSchema.parse(formData);
      mutation.mutate(formData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.issues?.[0]?.message || 'Validation error. Please check your inputs.';
        setErrorMsg(msg);
        toast.error(msg);
      } else {
        setErrorMsg('An unexpected error occurred.');
        toast.error('An unexpected error occurred.');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add New Owner</h2>
            <p className="text-xs text-gray-500 mt-1">Create a new restaurant owner account.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors bg-white shadow-sm border border-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm font-medium text-center">
              {errorMsg}
            </div>
          )}

          <form id="add-owner-form" onSubmit={handleSubmit} className="space-y-5">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Full Name <span className="text-red-500">*</span></label>
                <input 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" 
                  placeholder="Enter owner name"
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-gray-700">Email Address <span className="text-red-500">*</span></label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" 
                  placeholder="owner@example.com"
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
            </div>

            {/* KYC & Banking Settings */}
            <div className="pt-4 mt-2 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-4">KYC & Banking Details</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">PAN Number</label>
                  <input name="panNumber" value={formData.panNumber} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400 uppercase" placeholder="ABCDE1234F" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">GST Number</label>
                  <input name="gstNumber" value={formData.gstNumber} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400 uppercase" placeholder="Optional" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[13px] font-semibold text-gray-700">Bank Account Name <span className="text-red-500">*</span></label>
                  <input name="bankAccountName" value={formData.bankAccountName} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" placeholder="Name as per bank records" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">Account Number <span className="text-red-500">*</span></label>
                  <input name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400" placeholder="Account Number" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-gray-700">IFSC Code <span className="text-red-500">*</span></label>
                  <input name="bankIfscCode" value={formData.bankIfscCode} onChange={handleChange} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm focus:ring-1 focus:ring-primary focus:bg-white transition-colors placeholder:text-gray-400 uppercase" placeholder="IFSC Code" required />
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[13px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <Button 
            type="submit" 
            form="add-owner-form"
            className="px-6 py-2 text-[13px] font-semibold bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg shadow-sm"
            isLoading={mutation.isPending}
          >
            Create Owner
          </Button>
        </div>

      </div>
    </div>
  );
}

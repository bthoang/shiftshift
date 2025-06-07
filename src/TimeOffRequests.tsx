import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

interface TimeOffRequest {
  id: string;
  worker_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface TimeOffRequestsProps {
  workerId?: string;
  businessId: string;
  isManager: boolean;
  workers?: any[];
}

const TimeOffRequests: React.FC<TimeOffRequestsProps> = ({ 
  workerId, 
  businessId, 
  isManager,
  workers = []
}) => {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [workerId, businessId]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('time_off_requests')
        .select('*');

      if (isManager) {
        // Managers see all requests for their business
        const workerIds = workers.map(w => w.id);
        query = query.in('worker_id', workerIds);
      } else if (workerId) {
        // Employees see only their requests
        query = query.eq('worker_id', workerId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading time off requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!workerId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('time_off_requests')
        .insert({
          worker_id: workerId,
          start_date: formData.startDate,
          end_date: formData.endDate,
          reason: formData.reason,
          status: 'pending',
          created_by: workerId
        });

      if (error) throw error;

      setShowAddModal(false);
      setFormData({ startDate: '', endDate: '', reason: '' });
      loadRequests();
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: 'approved' | 'denied') => {
    try {
      const { error } = await supabase
        .from('time_off_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;
      loadRequests();
    } catch (error) {
      console.error('Error updating request:', error);
      alert('Failed to update request');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Approved</span>;
      case 'denied':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Denied</span>;
      default:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Pending</span>;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-500">Loading requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Time Off Requests</h3>
        {!isManager && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Request Time Off</span>
          </button>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No time off requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => {
            const worker = workers.find(w => w.id === request.worker_id);
            return (
              <div key={request.id} className="bg-white border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {isManager && worker && (
                      <p className="font-medium text-gray-900">{worker.name}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>
                        {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                      </span>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-gray-700">{request.reason}</p>
                    <p className="text-xs text-gray-500">
                      Requested on {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {isManager && request.status === 'pending' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => updateRequestStatus(request.id, 'approved')}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => updateRequestStatus(request.id, 'denied')}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Request Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Request Time Off</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Vacation, personal day, etc."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSubmit}
                disabled={saving || !formData.startDate || !formData.endDate || !formData.reason}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center justify-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeOffRequests;

// Temporary debug version to help identify the issue
// Add console.logs to see what's happening

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Save, RotateCcw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Calendar } from './Calendar';

interface AvailabilityManagementProps {
  workerId: string;
  currentUser: any;
  currentBusiness: any;
}

const AvailabilityManagement: React.FC<AvailabilityManagementProps> = ({
  workerId,
  currentUser,
  currentBusiness
}) => {
  console.log('AvailabilityManagement props:', { workerId, currentUser, currentBusiness });
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    console.log('useEffect triggered, currentBusiness:', currentBusiness);
    loadAvailability();
  }, [currentMonth, workerId, currentBusiness]);

  const loadAvailability = async () => {
    console.log('loadAvailability called');
    console.log('currentBusiness:', currentBusiness);
    console.log('day_configs:', currentBusiness?.day_configs);
    
    if (!currentBusiness || !currentBusiness.day_configs) {
      console.log('No business or day_configs, returning early');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Debug: Check what's in day_configs
      console.log('Day configs structure:', JSON.stringify(currentBusiness.day_configs, null, 2));
      
      // Rest of the loading logic...
      setLoading(false);
    } catch (error) {
      console.error('Error in loadAvailability:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">My Availability</h2>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading availability...</p>
        </div>
      </div>
    );
  }

  // Debug info panel
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">My Availability - Debug Mode</h2>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-bold mb-2">Debug Information:</h3>
        <pre className="text-xs overflow-auto">
          {JSON.stringify({
            workerId,
            hasCurrentBusiness: !!currentBusiness,
            businessName: currentBusiness?.name,
            setupComplete: currentBusiness?.setup_complete,
            hasDayConfigs: !!currentBusiness?.day_configs,
            dayConfigsKeys: currentBusiness?.day_configs ? Object.keys(currentBusiness.day_configs) : [],
            currentUserRole: currentUser?.role,
            currentUserWorkerId: currentUser?.worker_id
          }, null, 2)}
        </pre>
      </div>

      {!currentBusiness ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Business Not Loaded</h3>
          <p className="text-gray-600">
            The business information hasn't loaded. Try refreshing the page.
          </p>
        </div>
      ) : !currentBusiness.day_configs || Object.keys(currentBusiness.day_configs).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Schedule Configured</h3>
          <p className="text-gray-600">
            Your administrator hasn't set up the work schedule yet. 
            Please contact your manager to complete the business setup.
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <p>Setup complete: {currentBusiness.setup_complete ? 'Yes' : 'No'}</p>
            <p>Has roles: {currentBusiness.roles ? 'Yes' : 'No'}</p>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">
            Business is configured! Day configs found. 
            If you're still not seeing the calendar, check the browser console for errors.
          </p>
        </div>
      )}
    </div>
  );
};

export default AvailabilityManagement;

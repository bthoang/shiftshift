import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Save, RotateCcw, CheckCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

interface AvailabilityManagementProps {
  workerId: string;
  currentUser: any;
  currentBusiness: any;
}

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

interface DayAvailability {
  [key: string]: TimeSlot[];
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const AvailabilityManagement: React.FC<AvailabilityManagementProps> = ({
  workerId,
  currentUser,
  currentBusiness
}) => {
  const [availability, setAvailability] = useState<DayAvailability>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize availability structure
  useEffect(() => {
    initializeAvailability();
  }, [currentBusiness]);

  const initializeAvailability = () => {
    if (!currentBusiness?.day_configs) {
      setLoading(false);
      return;
    }

    const initialAvailability: DayAvailability = {};
    
    DAYS_OF_WEEK.forEach(({ key }) => {
      // Get day index (Sunday=0, Monday=1, etc.)
      const dayIndex = key === 'sunday' ? 0 : DAYS_OF_WEEK.findIndex(d => d.key === key);
      const dayConfig = currentBusiness.day_configs[dayIndex];
      
      if (dayConfig?.shifts) {
        initialAvailability[key] = dayConfig.shifts.map((shift: any) => ({
          start: shift.start,
          end: shift.end,
          available: true // Default to available
        }));
      } else {
        initialAvailability[key] = [];
      }
    });

    setAvailability(initialAvailability);
    loadExistingAvailability(initialAvailability);
  };

  const loadExistingAvailability = async (defaultAvailability: DayAvailability) => {
    try {
      const { data: worker } = await supabase
        .from('workers')
        .select('monthly_availability')
        .eq('id', workerId)
        .single();

      if (worker?.monthly_availability) {
        const monthKey = `${currentYear}-${currentMonth + 1}`;
        const monthlyData = worker.monthly_availability[monthKey];
        
        if (monthlyData) {
          setAvailability(monthlyData);
        } else {
          setAvailability(defaultAvailability);
        }
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = (day: string, shiftIndex: number) => {
    setAvailability(prev => ({
      ...prev,
      [day]: prev[day].map((shift, index) => 
        index === shiftIndex 
          ? { ...shift, available: !shift.available }
          : shift
      )
    }));
    setHasChanges(true);
  };

  const setDayFullyAvailable = (day: string, available: boolean) => {
    setAvailability(prev => ({
      ...prev,
      [day]: prev[day].map(shift => ({ ...shift, available }))
    }));
    setHasChanges(true);
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      const monthKey = `${currentYear}-${currentMonth + 1}`;
      
      // Get current monthly availability
      const { data: currentWorker } = await supabase
        .from('workers')
        .select('monthly_availability')
        .eq('id', workerId)
        .single();

      const updatedMonthlyAvailability = {
        ...(currentWorker?.monthly_availability || {}),
        [monthKey]: availability
      };

      const { error } = await supabase
        .from('workers')
        .update({ monthly_availability: updatedMonthlyAvailability })
        .eq('id', workerId);

      if (error) throw error;

      setHasChanges(false);
      alert('Availability saved successfully!');
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Failed to save availability. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    initializeAvailability();
    setHasChanges(true);
  };

  const getMonthName = () => {
    return new Date(currentYear, currentMonth).toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'next') {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    } else {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    }
    setHasChanges(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">My Availability</h2>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading availability...</p>
        </div>
      </div>
    );
  }

  if (!currentBusiness?.day_configs || Object.keys(currentBusiness.day_configs).length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">My Availability</h2>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Schedule Configured</h3>
          <p className="text-gray-600">
            Your administrator hasn't set up the work schedule yet. 
            Please contact your manager to configure the business schedule.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Availability</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={resetToDefault}
            className="flex items-center space-x-2 px-3 py-1 text-gray-600 hover:text-gray-800"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset to Available</span>
          </button>
          {hasChanges && (
            <button
              onClick={saveAvailability}
              disabled={saving}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateMonth('prev')}
            className="flex items-center space-x-2 px-3 py-1 text-gray-600 hover:text-gray-800"
          >
            ← Previous Month
          </button>
          <h3 className="text-xl font-bold text-gray-900">{getMonthName()}</h3>
          <button
            onClick={() => navigateMonth('next')}
            className="flex items-center space-x-2 px-3 py-1 text-gray-600 hover:text-gray-800"
          >
            Next Month →
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>How to set your availability:</strong> Click on individual time slots to toggle your availability. 
                Green means you're available, gray means you're not. Use the "All Day" buttons to quickly set your availability for entire days.
              </p>
            </div>
          </div>
        </div>

        {/* Availability Grid */}
        <div className="space-y-4">
          {DAYS_OF_WEEK.map(({ key, label }) => {
            const dayShifts = availability[key] || [];
            
            if (dayShifts.length === 0) {
              return (
                <div key={key} className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-2">{label}</h4>
                  <p className="text-sm text-gray-500">No shifts scheduled for this day</p>
                </div>
              );
            }

            const allAvailable = dayShifts.every(shift => shift.available);
            const noneAvailable = dayShifts.every(shift => !shift.available);

            return (
              <div key={key} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{label}</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setDayFullyAvailable(key, true)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        allAvailable 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                      }`}
                    >
                      All Day Available
                    </button>
                    <button
                      onClick={() => setDayFullyAvailable(key, false)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        noneAvailable 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                      }`}
                    >
                      Not Available
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {dayShifts.map((shift, index) => (
                    <button
                      key={index}
                      onClick={() => toggleAvailability(key, index)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        shift.available
                          ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {shift.start} - {shift.end}
                          </p>
                          <p className="text-xs">
                            {shift.available ? 'Available' : 'Not Available'}
                          </p>
                        </div>
                        {shift.available && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Save Reminder */}
        {hasChanges && (
          <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex items-center">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>You have unsaved changes.</strong> Don't forget to save your availability before leaving this page.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailabilityManagement;

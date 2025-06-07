import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Save, RotateCcw, CheckCircle, AlertCircle, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Calendar } from './Calendar';

interface AvailabilityManagementProps {
  workerId: string;
  currentUser: any;
  currentBusiness: any;
}

interface ShiftAvailability {
  available: boolean;
  preferred?: boolean;
}

interface DayAvailability {
  shifts: ShiftAvailability[];
}

interface MonthlyAvailability {
  [date: string]: DayAvailability;
}

const AvailabilityManagement: React.FC<AvailabilityManagementProps> = ({
  workerId,
  currentUser,
  currentBusiness
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState<MonthlyAvailability>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [defaultAvailability, setDefaultAvailability] = useState<Record<number, DayAvailability>>({});

  useEffect(() => {
    loadAvailability();
  }, [currentMonth, workerId]);

  const loadAvailability = async () => {
    if (!currentBusiness || !currentBusiness.day_configs) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Get worker data including monthly availability
      const { data: workerData, error } = await supabase
        .from('workers')
        .select('monthly_availability')
        .eq('id', workerId)
        .single();

      if (error) throw error;

      const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`;
      const monthAvailability = workerData?.monthly_availability?.[monthKey] || {};
      
      // Initialize availability for the month if not exists
      const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
      const newAvailability: MonthlyAvailability = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        
        const dayConfig = currentBusiness.day_configs[dayOfWeek];
        if (dayConfig?.shifts) {
          if (monthAvailability[dateStr]) {
            newAvailability[dateStr] = monthAvailability[dateStr];
          } else {
            // Default to available for all shifts
            newAvailability[dateStr] = {
              shifts: dayConfig.shifts.map(() => ({ available: true }))
            };
          }
        }
      }

      setAvailability(newAvailability);
      
      // Set default availability patterns from regular schedule
      const defaults: Record<number, DayAvailability> = {};
      for (let dow = 0; dow < 7; dow++) {
        const dayConfig = currentBusiness.day_configs[dow];
        if (dayConfig?.shifts) {
          defaults[dow] = {
            shifts: dayConfig.shifts.map(() => ({ available: true }))
          };
        }
      }
      setDefaultAvailability(defaults);
      
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = (dateStr: string, shiftIndex: number) => {
    setAvailability(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        shifts: prev[dateStr].shifts.map((shift, idx) => 
          idx === shiftIndex 
            ? { ...shift, available: !shift.available }
            : shift
        )
      }
    }));
    setHasChanges(true);
  };

  const togglePreferred = (dateStr: string, shiftIndex: number) => {
    setAvailability(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        shifts: prev[dateStr].shifts.map((shift, idx) => 
          idx === shiftIndex 
            ? { ...shift, preferred: !shift.preferred }
            : shift
        )
      }
    }));
    setHasChanges(true);
  };

  const applyDefaultToAll = () => {
    const newAvailability: MonthlyAvailability = {};
    
    Object.entries(availability).forEach(([dateStr, dayAvail]) => {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const defaultForDay = defaultAvailability[dayOfWeek];
      
      if (defaultForDay) {
        newAvailability[dateStr] = JSON.parse(JSON.stringify(defaultForDay));
      } else {
        newAvailability[dateStr] = dayAvail;
      }
    });
    
    setAvailability(newAvailability);
    setHasChanges(true);
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      // Get current worker data
      const { data: workerData, error: fetchError } = await supabase
        .from('workers')
        .select('monthly_availability')
        .eq('id', workerId)
        .single();

      if (fetchError) throw fetchError;

      const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`;
      const updatedMonthlyAvailability = {
        ...(workerData.monthly_availability || {}),
        [monthKey]: availability
      };

      // Update worker availability
      const { error: updateError } = await supabase
        .from('workers')
        .update({ monthly_availability: updatedMonthlyAvailability })
        .eq('id', workerId);

      if (updateError) throw updateError;

      setHasChanges(false);
      alert('Availability saved successfully!');
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Failed to save availability. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderCalendarDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayAvailability = availability[dateStr];
    
    if (!dayAvailability) {
      return <div className="text-xs text-gray-400">No shifts</div>;
    }

    const availableCount = dayAvailability.shifts.filter(s => s.available).length;
    const totalShifts = dayAvailability.shifts.length;
    const hasPreferred = dayAvailability.shifts.some(s => s.preferred);
    
    return (
      <div className="space-y-1">
        <div className={`text-xs font-medium ${
          availableCount === totalShifts ? 'text-green-600' : 
          availableCount === 0 ? 'text-red-600' : 'text-yellow-600'
        }`}>
          {availableCount}/{totalShifts} available
        </div>
        {hasPreferred && (
          <div className="text-xs text-blue-600">⭐ Preferred</div>
        )}
      </div>
    );
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

  if (!currentBusiness || !currentBusiness.day_configs || Object.keys(currentBusiness.day_configs).length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">My Availability</h2>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Schedule Configured</h3>
          <p className="text-gray-600">
            Your administrator hasn't set up the work schedule yet. 
            Please contact your manager to complete the business setup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Availability</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={applyDefaultToAll}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset to Default</span>
          </button>
          <button
            onClick={saveAvailability}
            disabled={!hasChanges || saving}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              hasChanges 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>How to set availability:</strong> Click on any day to view and edit your availability for each shift. 
              Green toggle means you're available, red means unavailable. Star indicates your preferred shifts.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-2">
          <Calendar
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            renderDay={renderCalendarDay}
            onDayClick={setSelectedDate}
          />
        </div>

        {/* Day Detail Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium text-gray-900 mb-4">
              {selectedDate 
                ? `Availability for ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                : 'Select a day to set availability'
              }
            </h3>
            
            {selectedDate && (() => {
              const dateStr = selectedDate.toISOString().split('T')[0];
              const dayAvailability = availability[dateStr];
              const dayOfWeek = selectedDate.getDay();
              const dayConfig = currentBusiness.day_configs[dayOfWeek];
              
              if (!dayConfig?.shifts || dayConfig.shifts.length === 0) {
                return (
                  <p className="text-gray-500 text-sm">Business is closed on this day.</p>
                );
              }

              return (
                <div className="space-y-3">
                  {dayConfig.shifts.map((shift: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium">{shift.name}</div>
                          <div className="text-sm text-gray-600">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {shift.start} - {shift.end}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAvailability(dateStr, idx)}
                          className={`p-1 rounded ${
                            dayAvailability?.shifts[idx]?.available 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                        >
                          {dayAvailability?.shifts[idx]?.available ? (
                            <ToggleRight className="h-6 w-6" />
                          ) : (
                            <ToggleLeft className="h-6 w-6" />
                          )}
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-sm ${
                          dayAvailability?.shifts[idx]?.available 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {dayAvailability?.shifts[idx]?.available ? 'Available' : 'Not Available'}
                        </span>
                        
                        {dayAvailability?.shifts[idx]?.available && (
                          <button
                            onClick={() => togglePreferred(dateStr, idx)}
                            className={`text-sm px-2 py-1 rounded ${
                              dayAvailability?.shifts[idx]?.preferred
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {dayAvailability?.shifts[idx]?.preferred ? '⭐ Preferred' : '☆ Set as Preferred'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow p-4 mt-4">
            <h4 className="font-medium text-gray-900 mb-3">This Month's Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Shifts Available:</span>
                <span className="font-medium">
                  {Object.values(availability).reduce((sum, day) => 
                    sum + day.shifts.filter(s => s.available).length, 0
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Preferred Shifts:</span>
                <span className="font-medium">
                  {Object.values(availability).reduce((sum, day) => 
                    sum + day.shifts.filter(s => s.preferred).length, 0
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Days Fully Available:</span>
                <span className="font-medium">
                  {Object.values(availability).filter(day => 
                    day.shifts.length > 0 && day.shifts.every(s => s.available)
                  ).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityManagement;

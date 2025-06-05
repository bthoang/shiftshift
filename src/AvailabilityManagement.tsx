import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Save, RotateCcw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Calendar } from './Calendar';

interface AvailabilityManagementProps {
  workerId: string;
  currentUser: any;
  currentBusiness: any;
}

interface ShiftAvailability {
  shiftId: string;
  start: string;
  end: string;
  available: boolean;
  shiftName: string;
}

interface DayAvailability {
  date: string;
  dayOfWeek: number;
  shifts: ShiftAvailability[];
}

const AvailabilityManagement: React.FC<AvailabilityManagementProps> = ({
  workerId,
  currentUser,
  currentBusiness
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    loadAvailability();
  }, [currentMonth, workerId]);

  const loadAvailability = async () => {
    setLoading(true);
    try {
      // Get worker's saved availability
      const { data: worker } = await supabase
        .from('workers')
        .select('monthly_availability')
        .eq('id', workerId)
        .single();

      const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`;
      const savedAvailability = worker?.monthly_availability?.[monthKey] || {};

      // Initialize availability for the month
      const monthAvailability: Record<string, DayAvailability> = {};
      const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        
        // Get shifts for this day from business config
        const dayConfig = currentBusiness.day_configs?.[dayOfWeek];
        
        monthAvailability[dateStr] = {
          date: dateStr,
          dayOfWeek,
          shifts: []
        };

        if (dayConfig?.shifts) {
          monthAvailability[dateStr].shifts = dayConfig.shifts.map((shift: any, index: number) => {
            const shiftKey = `${dateStr}-${index}`;
            return {
              shiftId: shiftKey,
              start: shift.start,
              end: shift.end,
              shiftName: shift.name,
              available: savedAvailability[dateStr]?.shifts?.[index]?.available ?? true
            };
          });
        }
      }

      setAvailability(monthAvailability);
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleShiftAvailability = (date: string, shiftIndex: number) => {
    setAvailability(prev => {
      const newAvailability = { ...prev };
      if (newAvailability[date]) {
        newAvailability[date] = {
          ...newAvailability[date],
          shifts: newAvailability[date].shifts.map((shift, idx) => 
            idx === shiftIndex 
              ? { ...shift, available: !shift.available }
              : shift
          )
        };
      }
      return newAvailability;
    });
    setHasChanges(true);
  };

  const setDayAvailability = (date: string, available: boolean) => {
    setAvailability(prev => {
      const newAvailability = { ...prev };
      if (newAvailability[date]) {
        newAvailability[date] = {
          ...newAvailability[date],
          shifts: newAvailability[date].shifts.map(shift => ({ ...shift, available }))
        };
      }
      return newAvailability;
    });
    setHasChanges(true);
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`;
      
      // Format availability for saving
      const formattedAvailability: any = {};
      Object.entries(availability).forEach(([date, dayData]) => {
        if (dayData.shifts.length > 0) {
          formattedAvailability[date] = {
            shifts: dayData.shifts.map(shift => ({
              available: shift.available
            }))
          };
        }
      });

      // Get current monthly availability
      const { data: currentWorker } = await supabase
        .from('workers')
        .select('monthly_availability')
        .eq('id', workerId)
        .single();

      const updatedMonthlyAvailability = {
        ...(currentWorker?.monthly_availability || {}),
        [monthKey]: formattedAvailability
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
    const resetAvailability = { ...availability };
    Object.keys(resetAvailability).forEach(date => {
      resetAvailability[date].shifts = resetAvailability[date].shifts.map(shift => ({
        ...shift,
        available: true
      }));
    });
    setAvailability(resetAvailability);
    setHasChanges(true);
  };

  const renderCalendarDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayData = availability[dateStr];
    
    if (!dayData || dayData.shifts.length === 0) {
      return <div className="text-xs text-gray-400">No shifts</div>;
    }

    const availableShifts = dayData.shifts.filter(s => s.available).length;
    const totalShifts = dayData.shifts.length;
    
    return (
      <div className="space-y-1">
        <div className={`text-xs font-medium ${
          availableShifts === totalShifts ? 'text-green-600' : 
          availableShifts === 0 ? 'text-red-600' : 'text-yellow-600'
        }`}>
          {availableShifts}/{totalShifts} shifts
        </div>
        <div className="space-y-1">
          {dayData.shifts.map((shift, idx) => (
            <div 
              key={idx} 
              className={`text-xs px-1 py-0.5 rounded ${
                shift.available ? 'bg-green-100' : 'bg-gray-100'
              }`}
            >
              {shift.start}-{shift.end}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
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
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex items-start">
          <CalendarIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>How to set your availability:</strong> Click on any day to see and edit your shift availability. 
              Green shifts mean you're available, gray means you're not. Your manager will use this information when creating schedules.
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
            onDayClick={handleDayClick}
          />
        </div>

        {/* Day Detail Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium text-gray-900 mb-4">
              {selectedDate 
                ? `Availability for ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                : 'Select a day to edit availability'
              }
            </h3>
            
            {selectedDate && (() => {
              const dateStr = selectedDate.toISOString().split('T')[0];
              const dayData = availability[dateStr];
              
              if (!dayData || dayData.shifts.length === 0) {
                return (
                  <p className="text-gray-500 text-sm">No shifts scheduled for this day.</p>
                );
              }

              return (
                <div className="space-y-3">
                  <div className="flex space-x-2 mb-4">
                    <button
                      onClick={() => setDayAvailability(dateStr, true)}
                      className="flex-1 text-sm bg-green-100 text-green-800 py-1 px-3 rounded hover:bg-green-200"
                    >
                      Available All Day
                    </button>
                    <button
                      onClick={() => setDayAvailability(dateStr, false)}
                      className="flex-1 text-sm bg-red-100 text-red-800 py-1 px-3 rounded hover:bg-red-200"
                    >
                      Not Available
                    </button>
                  </div>
                  
                  {dayData.shifts.map((shift, index) => (
                    <button
                      key={index}
                      onClick={() => toggleShiftAvailability(dateStr, index)}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        shift.available
                          ? 'bg-green-50 border-green-200 hover:bg-green-100'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{shift.shiftName}</p>
                          <p className="text-sm text-gray-600">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {shift.start} - {shift.end}
                          </p>
                        </div>
                        {shift.available ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-gray-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Legend */}
          <div className="bg-gray-50 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-gray-900 mb-2">Legend</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
                <span>Not Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Reminder */}
      {hasChanges && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
            <p className="text-sm text-yellow-700">
              <strong>You have unsaved changes.</strong> Don't forget to save your availability before leaving this page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityManagement;

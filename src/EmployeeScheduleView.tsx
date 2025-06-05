import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Calendar } from './Calendar';

interface EmployeeScheduleViewProps {
  workerId: string;
  businessId: string;
}

interface ScheduledShift {
  id: string;
  shift_date: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  role_id: number;
}

const EmployeeScheduleView: React.FC<EmployeeScheduleViewProps> = ({ workerId, businessId }) => {
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState<ScheduledShift[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    loadSchedule();
  }, [currentMonth, workerId]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      // Get the first and last day of the current month
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      // Fetch scheduled shifts for this worker in the current month
      const { data, error } = await supabase
        .from('scheduled_shifts')
        .select('*')
        .eq('worker_id', workerId)
        .gte('shift_date', firstDay.toISOString().split('T')[0])
        .lte('shift_date', lastDay.toISOString().split('T')[0])
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      setShifts(data || []);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(shift => shift.shift_date === dateStr);
  };

  const renderCalendarDay = (date: Date) => {
    const dayShifts = getShiftsForDate(date);
    
    if (dayShifts.length === 0) {
      return null;
    }

    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-blue-600">
          {dayShifts.length} shift{dayShifts.length > 1 ? 's' : ''}
        </div>
        {dayShifts.map((shift, idx) => (
          <div key={idx} className="text-xs bg-blue-100 px-1 py-0.5 rounded">
            {shift.start_time.slice(0, 5)}
          </div>
        ))}
      </div>
    );
  };

  const formatTime = (time: string) => {
    // Convert 24-hour time to 12-hour format
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">My Schedule</h2>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Schedule</h2>
        <div className="text-sm text-gray-500">
          Total shifts this month: {shifts.length}
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

        {/* Shift Details Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium text-gray-900 mb-4">
              {selectedDate 
                ? `Shifts for ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                : 'Select a day to view shift details'
              }
            </h3>
            
            {selectedDate && (() => {
              const dayShifts = getShiftsForDate(selectedDate);
              
              if (dayShifts.length === 0) {
                return (
                  <p className="text-gray-500 text-sm">No shifts scheduled for this day.</p>
                );
              }

              return (
                <div className="space-y-3">
                  {dayShifts.map((shift) => (
                    <div key={shift.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="font-medium text-gray-900">
                        {shift.shift_name}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Upcoming Shifts */}
          <div className="bg-white rounded-lg shadow p-4 mt-4">
            <h4 className="font-medium text-gray-900 mb-3">Upcoming Shifts</h4>
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const upcomingShifts = shifts
                .filter(shift => new Date(shift.shift_date) >= today)
                .slice(0, 5);

              if (upcomingShifts.length === 0) {
                return (
                  <p className="text-gray-500 text-sm">No upcoming shifts scheduled.</p>
                );
              }

              return (
                <div className="space-y-2">
                  {upcomingShifts.map((shift) => (
                    <div key={shift.id} className="text-sm">
                      <div className="font-medium">
                        {new Date(shift.shift_date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="text-gray-600">
                        {shift.shift_name} • {formatTime(shift.start_time)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {shifts.length === 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                No shifts scheduled for this month. Your schedule will appear here once your manager assigns you shifts.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeScheduleView;

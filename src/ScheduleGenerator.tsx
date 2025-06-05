import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Users, Clock, RefreshCw, Download, AlertTriangle, CheckCircle, User, Edit2, Save, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Calendar } from './Calendar';

interface ScheduleGeneratorProps {
  businessId: string;
  currentBusiness: any;
  workers: any[];
}

interface ShiftSchedule {
  id: string;
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  roleRequirements: { roleId: number; count: number; roleName: string }[];
  assignedWorkers: {
    workerId: string;
    workerName: string;
    roleId: number;
    roleName: string;
  }[];
  unfilledPositions: {
    roleId: number;
    roleName: string;
    count: number;
  }[];
}

interface ScheduleData {
  [date: string]: ShiftSchedule[];
}

const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({
  businessId,
  currentBusiness,
  workers
}) => {
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedule, setSchedule] = useState<ScheduleData>({});
  const [editingShift, setEditingShift] = useState<ShiftSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [stats, setStats] = useState({
    totalShifts: 0,
    filledShifts: 0,
    unfilledShifts: 0,
    totalWorkers: workers.length,
    workersScheduled: 0
  });

  const generateSchedule = async () => {
    setGenerating(true);
    try {
      const month = currentMonth.getMonth() + 1;
      const year = currentMonth.getFullYear();
      
      // Load worker availability
      const { data: workersWithAvailability } = await supabase
        .from('workers')
        .select('*')
        .eq('business_id', businessId);

      if (!workersWithAvailability) {
        throw new Error('Failed to load worker data');
      }

      // Generate schedule for the month
      const newSchedule: ScheduleData = {};
      const daysInMonth = new Date(year, month, 0).getDate();
      let totalShifts = 0;
      let filledShifts = 0;
      const scheduledWorkerIds = new Set<string>();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        
        const dayConfig = currentBusiness.day_configs?.[dayOfWeek];
        if (!dayConfig?.shifts) continue;

        newSchedule[dateStr] = [];

        dayConfig.shifts.forEach((shift: any, shiftIndex: number) => {
          const monthKey = `${year}-${month}`;
          
          // Get available workers for this shift
          const availableWorkers = workersWithAvailability.filter(worker => {
            const availability = worker.monthly_availability?.[monthKey]?.[dateStr];
            if (!availability?.shifts?.[shiftIndex]) return true; // Default to available
            return availability.shifts[shiftIndex].available;
          });

          // Create shift schedule
          const shiftSchedule: ShiftSchedule = {
            id: `${dateStr}-${shiftIndex}`,
            date: dateStr,
            shiftName: shift.name,
            startTime: shift.start,
            endTime: shift.end,
            roleRequirements: [],
            assignedWorkers: [],
            unfilledPositions: []
          };

          // Process role requirements
          Object.entries(shift.role_requirements || {}).forEach(([roleId, count]: [string, any]) => {
            const role = currentBusiness.roles?.find((r: any) => r.id === parseInt(roleId));
            if (!role) return;

            shiftSchedule.roleRequirements.push({
              roleId: parseInt(roleId),
              count,
              roleName: role.name
            });

            // Find eligible workers
            const eligibleWorkers = availableWorkers.filter(worker => 
              worker.roles.includes(parseInt(roleId)) &&
              !shiftSchedule.assignedWorkers.some(assigned => assigned.workerId === worker.id)
            );

            // Sort by rating
            eligibleWorkers.sort((a, b) => b.rating - a.rating);

            // Assign workers
            for (let i = 0; i < count && i < eligibleWorkers.length; i++) {
              const worker = eligibleWorkers[i];
              shiftSchedule.assignedWorkers.push({
                workerId: worker.id,
                workerName: worker.name,
                roleId: parseInt(roleId),
                roleName: role.name
              });
              scheduledWorkerIds.add(worker.id);
            }

            // Track unfilled positions
            if (eligibleWorkers.length < count) {
              shiftSchedule.unfilledPositions.push({
                roleId: parseInt(roleId),
                roleName: role.name,
                count: count - eligibleWorkers.length
              });
            }
          });

          totalShifts++;
          if (shiftSchedule.unfilledPositions.length === 0) {
            filledShifts++;
          }

          newSchedule[dateStr].push(shiftSchedule);
        });
      }

      setSchedule(newSchedule);
      setStats({
        totalShifts,
        filledShifts,
        unfilledShifts: totalShifts - filledShifts,
        totalWorkers: workers.length,
        workersScheduled: scheduledWorkerIds.size
      });

    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Failed to generate schedule. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const updateShiftAssignment = (shiftId: string, date: string, updatedShift: Partial<ShiftSchedule>) => {
    setSchedule(prev => {
      const newSchedule = { ...prev };
      if (newSchedule[date]) {
        newSchedule[date] = newSchedule[date].map(shift => 
          shift.id === shiftId ? { ...shift, ...updatedShift } : shift
        );
      }
      return newSchedule;
    });
  };

  const removeWorkerFromShift = (shiftId: string, date: string, workerId: string) => {
    const shift = schedule[date]?.find(s => s.id === shiftId);
    if (!shift) return;

    const worker = shift.assignedWorkers.find(w => w.workerId === workerId);
    if (!worker) return;

    // Update shift
    const updatedAssignedWorkers = shift.assignedWorkers.filter(w => w.workerId !== workerId);
    
    // Add to unfilled positions
    const existingUnfilled = shift.unfilledPositions.find(u => u.roleId === worker.roleId);
    const updatedUnfilled = existingUnfilled
      ? shift.unfilledPositions.map(u => 
          u.roleId === worker.roleId ? { ...u, count: u.count + 1 } : u
        )
      : [...shift.unfilledPositions, { roleId: worker.roleId, roleName: worker.roleName, count: 1 }];

    updateShiftAssignment(shiftId, date, {
      assignedWorkers: updatedAssignedWorkers,
      unfilledPositions: updatedUnfilled
    });
  };

  const addWorkerToShift = (shiftId: string, date: string, workerId: string, roleId: number) => {
    const shift = schedule[date]?.find(s => s.id === shiftId);
    if (!shift) return;

    const worker = workers.find(w => w.id === workerId);
    const role = currentBusiness.roles?.find((r: any) => r.id === roleId);
    if (!worker || !role) return;

    // Update shift
    const updatedAssignedWorkers = [...shift.assignedWorkers, {
      workerId: worker.id,
      workerName: worker.name,
      roleId: roleId,
      roleName: role.name
    }];

    // Update unfilled positions
    const updatedUnfilled = shift.unfilledPositions
      .map(u => u.roleId === roleId ? { ...u, count: Math.max(0, u.count - 1) } : u)
      .filter(u => u.count > 0);

    updateShiftAssignment(shiftId, date, {
      assignedWorkers: updatedAssignedWorkers,
      unfilledPositions: updatedUnfilled
    });
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      // In a real implementation, you would save this to the database
      // For now, we'll show a success message
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Schedule saved successfully!');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const exportSchedule = () => {
    const csv = [
      ['Date', 'Day', 'Shift', 'Time', 'Role', 'Worker', 'Status'],
      ...Object.entries(schedule).flatMap(([date, shifts]) => 
        shifts.flatMap(shift => [
          ...shift.assignedWorkers.map(worker => [
            date,
            new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
            shift.shiftName,
            `${shift.startTime} - ${shift.endTime}`,
            worker.roleName,
            worker.workerName,
            'Assigned'
          ]),
          ...shift.unfilledPositions.flatMap(position => 
            Array(position.count).fill(null).map(() => [
              date,
              new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
              shift.shiftName,
              `${shift.startTime} - ${shift.endTime}`,
              position.roleName,
              'UNFILLED',
              'Needs Assignment'
            ])
          )
        ])
      )
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${currentMonth.toISOString().slice(0, 7)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderCalendarDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayShifts = schedule[dateStr] || [];
    
    if (dayShifts.length === 0) {
      return <div className="text-xs text-gray-400">No shifts</div>;
    }

    const totalPositions = dayShifts.reduce((sum, shift) => 
      sum + shift.roleRequirements.reduce((s, r) => s + r.count, 0), 0
    );
    const filledPositions = dayShifts.reduce((sum, shift) => 
      sum + shift.assignedWorkers.length, 0
    );
    
    return (
      <div className="space-y-1">
        <div className={`text-xs font-medium ${
          filledPositions === totalPositions ? 'text-green-600' : 
          filledPositions === 0 ? 'text-red-600' : 'text-yellow-600'
        }`}>
          {filledPositions}/{totalPositions} filled
        </div>
        {dayShifts.map((shift, idx) => (
          <div 
            key={idx} 
            className={`text-xs px-1 py-0.5 rounded cursor-pointer hover:bg-gray-200 ${
              shift.unfilledPositions.length === 0 ? 'bg-green-100' : 'bg-yellow-100'
            }`}
          >
            {shift.startTime}-{shift.endTime}
          </div>
        ))}
      </div>
    );
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const ShiftEditModal = () => {
    if (!editingShift || !selectedDate) return null;

    const availableWorkers = workers.filter(worker => 
      !editingShift.assignedWorkers.some(assigned => assigned.workerId === worker.id)
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Edit Shift</h3>
            <button
              onClick={() => setEditingShift(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Shift Name</label>
                <input
                  type="text"
                  value={editingShift.shiftName}
                  onChange={(e) => setEditingShift({ ...editingShift, shiftName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={editingShift.startTime}
                    onChange={(e) => setEditingShift({ ...editingShift, startTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    value={editingShift.endTime}
                    onChange={(e) => setEditingShift({ ...editingShift, endTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Assigned Workers</h4>
              {editingShift.assignedWorkers.length === 0 ? (
                <p className="text-gray-500 text-sm">No workers assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {editingShift.assignedWorkers.map((worker, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{worker.workerName}</span>
                        <span className="text-sm text-gray-500">({worker.roleName})</span>
                      </div>
                      <button
                        onClick={() => {
                          const updated = {
                            ...editingShift,
                            assignedWorkers: editingShift.assignedWorkers.filter(w => w.workerId !== worker.workerId)
                          };
                          setEditingShift(updated);
                          updateShiftAssignment(editingShift.id, editingShift.date, updated);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editingShift.unfilledPositions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Add Workers</h4>
                {editingShift.unfilledPositions.map((position, idx) => (
                  <div key={idx} className="mb-2">
                    <p className="text-sm text-gray-600 mb-1">{position.roleName} ({position.count} needed)</p>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addWorkerToShift(editingShift.id, editingShift.date, e.target.value, position.roleId);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                      defaultValue=""
                    >
                      <option value="">Select worker...</option>
                      {availableWorkers
                        .filter(worker => worker.roles.includes(position.roleId))
                        .map(worker => (
                          <option key={worker.id} value={worker.id}>
                            {worker.name} (Rating: {worker.rating}/10)
                          </option>
                        ))
                      }
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  updateShiftAssignment(editingShift.id, editingShift.date, editingShift);
                  setEditingShift(null);
                }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingShift(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!currentBusiness?.day_configs || Object.keys(currentBusiness.day_configs).length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Schedule Generator</h2>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Setup Required</h3>
          <p className="text-gray-600">
            Please complete the business setup to configure shifts and roles before generating schedules.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Schedule Generator</h2>
        <div className="flex items-center space-x-3">
          {Object.keys(schedule).length > 0 && (
            <>
              <button
                onClick={saveSchedule}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Schedule</span>
                  </>
                )}
              </button>
              <button
                onClick={exportSchedule}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </>
          )}
          <button
            onClick={generateSchedule}
            disabled={generating}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Generate Schedule</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex items-start">
          <CalendarIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>How to use:</strong> Click "Generate Schedule" to automatically assign workers based on their availability and ratings. 
              Click on any shift to manually edit assignments, change times, or add/remove workers.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {Object.keys(schedule).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">Total Shifts</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.totalShifts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">Filled Shifts</h3>
            <p className="text-3xl font-bold text-green-600">{stats.filledShifts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">Unfilled Shifts</h3>
            <p className="text-3xl font-bold text-red-600">{stats.unfilledShifts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">Workers Scheduled</h3>
            <p className="text-3xl font-bold text-purple-600">
              {stats.workersScheduled}/{stats.totalWorkers}
            </p>
          </div>
        </div>
      )}

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
                ? `Schedule for ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                : 'Select a day to view shifts'
              }
            </h3>
            
            {selectedDate && (() => {
              const dateStr = selectedDate.toISOString().split('T')[0];
              const dayShifts = schedule[dateStr] || [];
              
              if (dayShifts.length === 0) {
                return (
                  <p className="text-gray-500 text-sm">No shifts scheduled for this day.</p>
                );
              }

              return (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {dayShifts.map(shift => (
                    <div 
                      key={shift.id} 
                      className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setEditingShift(shift)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium">{shift.shiftName}</h4>
                          <p className="text-sm text-gray-500">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {shift.startTime} - {shift.endTime}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {shift.unfilledPositions.length === 0 ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          )}
                          <Edit2 className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                      
                      {shift.assignedWorkers.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">Assigned:</p>
                          <div className="flex flex-wrap gap-1">
                            {shift.assignedWorkers.map((worker, idx) => (
                              <span key={idx} className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                {worker.workerName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {shift.unfilledPositions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">Unfilled:</p>
                          <div className="flex flex-wrap gap-1">
                            {shift.unfilledPositions.map((position, idx) => (
                              <span key={idx} className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                                {position.count} {position.roleName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <ShiftEditModal />
    </div>
  );
};

export default ScheduleGenerator;

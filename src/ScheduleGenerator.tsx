import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, RefreshCw, Download, AlertTriangle, CheckCircle, User } from 'lucide-react';
import { supabase } from './supabaseClient';

interface ScheduleGeneratorProps {
  businessId: string;
  currentBusiness: any;
  workers: any[];
}

interface ShiftAssignment {
  shiftId: string;
  shiftName: string;
  day: string;
  startTime: string;
  endTime: string;
  roleRequirements: { roleId: number; count: number; }[];
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

interface GeneratedSchedule {
  weekStartDate: string;
  assignments: ShiftAssignment[];
  stats: {
    totalShifts: number;
    filledShifts: number;
    unfilledShifts: number;
    totalWorkers: number;
    workersScheduled: number;
  };
}

const DAYS_OF_WEEK = [
  { key: 'sunday', label: 'Sunday', index: 0 },
  { key: 'monday', label: 'Monday', index: 1 },
  { key: 'tuesday', label: 'Tuesday', index: 2 },
  { key: 'wednesday', label: 'Wednesday', index: 3 },
  { key: 'thursday', label: 'Thursday', index: 4 },
  { key: 'friday', label: 'Friday', index: 5 },
  { key: 'saturday', label: 'Saturday', index: 6 }
];

const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({
  businessId,
  currentBusiness,
  workers
}) => {
  const [generating, setGenerating] = useState(false);
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    return startOfWeek.toISOString().split('T')[0];
  });

  const generateSchedule = async () => {
    setGenerating(true);
    try {
      // Get worker availability for the selected week
      const weekStart = new Date(selectedWeek);
      const month = weekStart.getMonth() + 1;
      const year = weekStart.getFullYear();
      
      // Load worker availability
      const { data: workersWithAvailability } = await supabase
        .from('workers')
        .select('*')
        .eq('business_id', businessId);

      if (!workersWithAvailability) {
        throw new Error('Failed to load worker data');
      }

      // Generate assignments
      const assignments: ShiftAssignment[] = [];
      
      Object.entries(currentBusiness.day_configs || {}).forEach(([dayIndex, dayConfig]: [string, any]) => {
        const day = DAYS_OF_WEEK.find(d => d.index === parseInt(dayIndex));
        if (!day || !dayConfig.shifts) return;

        dayConfig.shifts.forEach((shift: any, shiftIndex: number) => {
          const shiftId = `${dayIndex}-${shiftIndex}`;
          
          // Get available workers for this day/shift
          const availableWorkers = workersWithAvailability.filter(worker => {
            const monthKey = `${year}-${month}`;
            const availability = worker.monthly_availability?.[monthKey]?.[day.key];
            
            if (!availability) return true; // Default to available if no data
            
            // Check if worker is available for this shift time
            return availability.some((slot: any) => 
              slot.start === shift.start && 
              slot.end === shift.end && 
              slot.available
            );
          });

          // Assign workers based on role requirements
          const assignedWorkers: ShiftAssignment['assignedWorkers'] = [];
          const unfilledPositions: ShiftAssignment['unfilledPositions'] = [];
          
          Object.entries(shift.role_requirements || {}).forEach(([roleId, count]: [string, any]) => {
            const role = currentBusiness.roles?.find((r: any) => r.id === parseInt(roleId));
            if (!role) return;

            // Find workers with this role who are available
            const eligibleWorkers = availableWorkers.filter(worker => 
              worker.roles.includes(parseInt(roleId)) &&
              !assignedWorkers.some(assigned => assigned.workerId === worker.id)
            );

            // Sort by rating (highest first)
            eligibleWorkers.sort((a, b) => b.rating - a.rating);

            // Assign workers up to the required count
            for (let i = 0; i < count && i < eligibleWorkers.length; i++) {
              const worker = eligibleWorkers[i];
              assignedWorkers.push({
                workerId: worker.id,
                workerName: worker.name,
                roleId: parseInt(roleId),
                roleName: role.name
              });
            }

            // Track unfilled positions
            if (eligibleWorkers.length < count) {
              unfilledPositions.push({
                roleId: parseInt(roleId),
                roleName: role.name,
                count: count - eligibleWorkers.length
              });
            }
          });

          assignments.push({
            shiftId,
            shiftName: shift.name,
            day: day.label,
            startTime: shift.start,
            endTime: shift.end,
            roleRequirements: Object.entries(shift.role_requirements || {}).map(([roleId, count]: [string, any]) => {
              const role = currentBusiness.roles?.find((r: any) => r.id === parseInt(roleId));
              return {
                roleId: parseInt(roleId),
                count
              };
            }),
            assignedWorkers,
            unfilledPositions
          });
        });
      });

      // Calculate stats
      const assignedWorkerIds = new Set();
      assignments.forEach(assignment => {
        assignment.assignedWorkers.forEach(worker => {
          assignedWorkerIds.add(worker.workerId);
        });
      });

      const stats = {
        totalShifts: assignments.length,
        filledShifts: assignments.filter(a => a.unfilledPositions.length === 0).length,
        unfilledShifts: assignments.filter(a => a.unfilledPositions.length > 0).length,
        totalWorkers: workers.length,
        workersScheduled: assignedWorkerIds.size
      };

      setSchedule({
        weekStartDate: selectedWeek,
        assignments: assignments.sort((a, b) => {
          const dayOrder = DAYS_OF_WEEK.findIndex(d => d.label === a.day) - DAYS_OF_WEEK.findIndex(d => d.label === b.day);
          if (dayOrder !== 0) return dayOrder;
          return a.startTime.localeCompare(b.startTime);
        }),
        stats
      });

    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Failed to generate schedule. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const exportSchedule = () => {
    if (!schedule) return;

    const csv = [
      ['Day', 'Shift', 'Time', 'Role', 'Worker', 'Status'],
      ...schedule.assignments.flatMap(assignment => [
        ...assignment.assignedWorkers.map(worker => [
          assignment.day,
          assignment.shiftName,
          `${assignment.startTime} - ${assignment.endTime}`,
          worker.roleName,
          worker.workerName,
          'Assigned'
        ]),
        ...assignment.unfilledPositions.map(position => [
          assignment.day,
          assignment.shiftName,
          `${assignment.startTime} - ${assignment.endTime}`,
          position.roleName,
          'UNFILLED',
          'Needs Assignment'
        ])
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${schedule.weekStartDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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

  if (workers.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Schedule Generator</h2>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Users className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Workers Added</h3>
          <p className="text-gray-600">
            Add workers to your business before generating schedules. Go to the Workers tab to add team members.
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
          {schedule && (
            <button
              onClick={exportSchedule}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          )}
          <button
            onClick={generateSchedule}
            disabled={generating}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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

      {/* Week Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <label className="font-medium text-gray-700">Week Starting:</label>
          <input
            type="date"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
          <span className="text-sm text-gray-500">
            (Week of {new Date(selectedWeek).toLocaleDateString()})
          </span>
        </div>
      </div>

      {/* Schedule Stats */}
      {schedule && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">Total Shifts</h3>
            <p className="text-3xl font-bold text-blue-600">{schedule.stats.totalShifts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">Filled Shifts</h3>
            <p className="text-3xl font-bold text-green-600">{schedule.stats.filledShifts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">Unfilled Shifts</h3>
            <p className="text-3xl font-bold text-red-600">{schedule.stats.unfilledShifts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-2">Workers Scheduled</h3>
            <p className="text-3xl font-bold text-purple-600">
              {schedule.stats.workersScheduled}/{schedule.stats.totalWorkers}
            </p>
          </div>
        </div>
      )}

      {/* Generated Schedule */}
      {schedule ? (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-xl font-bold text-gray-900">
              Weekly Schedule - {new Date(schedule.weekStartDate).toLocaleDateString()}
            </h3>
          </div>
          
          <div className="p-6">
            {schedule.stats.unfilledShifts > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                  <div>
                    <p className="text-sm text-yellow-700">
                      <strong>Warning:</strong> {schedule.stats.unfilledShifts} shifts have unfilled positions. 
                      Consider adjusting worker availability or hiring additional staff.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {DAYS_OF_WEEK.map(day => {
                const dayAssignments = schedule.assignments.filter(a => a.day === day.label);
                
                if (dayAssignments.length === 0) {
                  return (
                    <div key={day.key} className="border rounded-lg p-4 bg-gray-50">
                      <h4 className="font-bold text-gray-900 mb-2">{day.label}</h4>
                      <p className="text-gray-500">No shifts scheduled</p>
                    </div>
                  );
                }

                return (
                  <div key={day.key} className="border rounded-lg p-4">
                    <h4 className="font-bold text-gray-900 mb-4">{day.label}</h4>
                    
                    <div className="space-y-4">
                      {dayAssignments.map(assignment => (
                        <div key={assignment.shiftId} className="border-l-4 border-blue-200 pl-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h5 className="font-medium text-gray-900">{assignment.shiftName}</h5>
                              <p className="text-sm text-gray-500">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {assignment.startTime} - {assignment.endTime}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {assignment.unfilledPositions.length === 0 ? (
                                <span className="flex items-center text-green-600 text-sm">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Fully Staffed
                                </span>
                              ) : (
                                <span className="flex items-center text-red-600 text-sm">
                                  <AlertTriangle className="h-4 w-4 mr-1" />
                                  {assignment.unfilledPositions.length} Unfilled
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Assigned Workers */}
                          {assignment.assignedWorkers.length > 0 && (
                            <div className="mb-2">
                              <p className="text-sm font-medium text-gray-700 mb-1">Assigned Workers:</p>
                              <div className="flex flex-wrap gap-2">
                                {assignment.assignedWorkers.map((worker, index) => (
                                  <span key={index} className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                    <User className="h-3 w-3 mr-1" />
                                    {worker.workerName} ({worker.roleName})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unfilled Positions */}
                          {assignment.unfilledPositions.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Unfilled Positions:</p>
                              <div className="flex flex-wrap gap-2">
                                {assignment.unfilledPositions.map((position, index) => (
                                  <span key={index} className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {position.count} {position.roleName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Generate Schedule</h3>
          <p className="text-gray-600 mb-4">
            Select a week and click "Generate Schedule" to automatically assign workers based on their availability and ratings.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>• Workers are assigned based on their availability and role qualifications</p>
            <p>• Higher-rated workers are prioritized for assignments</p>
            <p>• Unfilled positions will be highlighted for manual review</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleGenerator;

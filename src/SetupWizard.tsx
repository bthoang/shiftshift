import React, { useState, useEffect } from 'react';
import { Check, ChevronRight, ChevronLeft, Plus, Trash2, Clock, Users, Calendar, Settings, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';

interface SetupWizardProps {
  businessId: string;
  onComplete: () => void;
}

interface Role {
  id: string;
  name: string;
  color: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  roleRequirements: { roleId: string; count: number }[];
}

interface DaySchedule {
  enabled: boolean;
  shifts: ShiftTemplate[];
}

const PRESET_ROLES = [
  { name: 'Manager', color: '#3B82F6' },
  { name: 'Server', color: '#10B981' },
  { name: 'Cook', color: '#F59E0B' },
  { name: 'Cashier', color: '#8B5CF6' },
  { name: 'Barista', color: '#EC4899' },
  { name: 'Host', color: '#06B6D4' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SetupWizard: React.FC<SetupWizardProps> = ({ businessId, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Step 1: Roles
  const [roles, setRoles] = useState<Role[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedPresetRoles, setSelectedPresetRoles] = useState<string[]>([]);
  
  // Step 2: Shift Templates
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([
    {
      id: '1',
      name: 'Morning Shift',
      startTime: '07:00',
      endTime: '15:00',
      roleRequirements: []
    },
    {
      id: '2',
      name: 'Evening Shift',
      startTime: '15:00',
      endTime: '23:00',
      roleRequirements: []
    }
  ]);
  
  // Step 3: Weekly Schedule
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, DaySchedule>>(() => {
    const schedule: Record<string, DaySchedule> = {};
    DAYS_OF_WEEK.forEach(day => {
      schedule[day] = {
        enabled: day !== 'Sunday',
        shifts: []
      };
    });
    return schedule;
  });

  const steps = [
    { title: 'Business Roles', icon: Users, description: 'Define the roles in your business' },
    { title: 'Shift Templates', icon: Clock, description: 'Create reusable shift patterns' },
    { title: 'Weekly Schedule', icon: Calendar, description: 'Set up your regular weekly schedule' },
    { title: 'Review & Finish', icon: Settings, description: 'Review your configuration' }
  ];

  // Add preset role
  const addPresetRole = (presetRole: typeof PRESET_ROLES[0]) => {
    const newRole: Role = {
      id: Date.now().toString(),
      name: presetRole.name,
      color: presetRole.color
    };
    setRoles([...roles, newRole]);
    setSelectedPresetRoles([...selectedPresetRoles, presetRole.name]);
  };

  // Add custom role
  const addCustomRole = () => {
    if (newRoleName.trim()) {
      const newRole: Role = {
        id: Date.now().toString(),
        name: newRoleName.trim(),
        color: '#6B7280'
      };
      setRoles([...roles, newRole]);
      setNewRoleName('');
    }
  };

  // Remove role
  const removeRole = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    setRoles(roles.filter(r => r.id !== roleId));
    if (role) {
      setSelectedPresetRoles(selectedPresetRoles.filter(name => name !== role.name));
    }
    // Also remove from shift requirements
    setShiftTemplates(templates => 
      templates.map(template => ({
        ...template,
        roleRequirements: template.roleRequirements.filter(req => req.roleId !== roleId)
      }))
    );
  };

  // Add shift template
  const addShiftTemplate = () => {
    const newShift: ShiftTemplate = {
      id: Date.now().toString(),
      name: `Shift ${shiftTemplates.length + 1}`,
      startTime: '09:00',
      endTime: '17:00',
      roleRequirements: []
    };
    setShiftTemplates([...shiftTemplates, newShift]);
  };

  // Update shift template
  const updateShiftTemplate = (shiftId: string, updates: Partial<ShiftTemplate>) => {
    setShiftTemplates(templates =>
      templates.map(template =>
        template.id === shiftId ? { ...template, ...updates } : template
      )
    );
  };

  // Add role requirement to shift
  const addRoleRequirement = (shiftId: string) => {
    if (roles.length === 0) return;
    
    const shift = shiftTemplates.find(s => s.id === shiftId);
    if (shift) {
      const availableRoles = roles.filter(role => 
        !shift.roleRequirements.some(req => req.roleId === role.id)
      );
      
      if (availableRoles.length > 0) {
        const newRequirement = {
          roleId: availableRoles[0].id,
          count: 1
        };
        
        updateShiftTemplate(shiftId, {
          roleRequirements: [...shift.roleRequirements, newRequirement]
        });
      }
    }
  };

  // Update role requirement
  const updateRoleRequirement = (shiftId: string, index: number, updates: Partial<{ roleId: string; count: number }>) => {
    const shift = shiftTemplates.find(s => s.id === shiftId);
    if (shift) {
      const newRequirements = [...shift.roleRequirements];
      newRequirements[index] = { ...newRequirements[index], ...updates };
      updateShiftTemplate(shiftId, { roleRequirements: newRequirements });
    }
  };

  // Remove role requirement
  const removeRoleRequirement = (shiftId: string, index: number) => {
    const shift = shiftTemplates.find(s => s.id === shiftId);
    if (shift) {
      const newRequirements = shift.roleRequirements.filter((_, i) => i !== index);
      updateShiftTemplate(shiftId, { roleRequirements: newRequirements });
    }
  };

  // Toggle day enabled
  const toggleDayEnabled = (day: string) => {
    setWeeklySchedule(schedule => ({
      ...schedule,
      [day]: {
        ...schedule[day],
        enabled: !schedule[day].enabled
      }
    }));
  };

  // Add shift to day
  const addShiftToDay = (day: string, shiftTemplateId: string) => {
    const template = shiftTemplates.find(t => t.id === shiftTemplateId);
    if (template) {
      setWeeklySchedule(schedule => ({
        ...schedule,
        [day]: {
          ...schedule[day],
          shifts: [...schedule[day].shifts, { ...template, id: Date.now().toString() }]
        }
      }));
    }
  };

  // Remove shift from day
  const removeShiftFromDay = (day: string, shiftId: string) => {
    setWeeklySchedule(schedule => ({
      ...schedule,
      [day]: {
        ...schedule[day],
        shifts: schedule[day].shifts.filter(s => s.id !== shiftId)
      }
    }));
  };

  // Save configuration
  const saveConfiguration = async () => {
    setSaving(true);
    try {
      // Format roles for database
      const formattedRoles = roles.map((role, index) => ({
        id: index + 1,
        name: role.name,
        color: role.color
      }));

      // Format day configs for database
      const dayConfigs: Record<number, any> = {};
      DAYS_OF_WEEK.forEach((day, index) => {
        const daySchedule = weeklySchedule[day];
        if (daySchedule.enabled) {
          dayConfigs[index] = {
            shifts: daySchedule.shifts.map(shift => ({
              name: shift.name,
              start: shift.startTime,
              end: shift.endTime,
              role_requirements: shift.roleRequirements.reduce((acc, req) => {
                const role = roles.find(r => r.id === req.roleId);
                const roleIndex = roles.findIndex(r => r.id === req.roleId) + 1;
                if (role) {
                  acc[roleIndex] = req.count;
                }
                return acc;
              }, {} as Record<number, number>)
            }))
          };
        }
      });

      // Update business configuration
      const { error } = await supabase
        .from('businesses')
        .update({
          roles: formattedRoles,
          day_configs: dayConfigs,
          setup_complete: true
        })
        .eq('id', businessId);

      if (error) throw error;

      // Success!
      onComplete();
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Validation
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 0:
        return roles.length > 0;
      case 1:
        return shiftTemplates.length > 0 && 
               shiftTemplates.every(shift => 
                 shift.name && 
                 shift.startTime && 
                 shift.endTime && 
                 shift.roleRequirements.length > 0
               );
      case 2:
        return Object.values(weeklySchedule).some(day => day.enabled && day.shifts.length > 0);
      default:
        return true;
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Quick Add Common Roles</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PRESET_ROLES.map(role => (
                  <button
                    key={role.name}
                    onClick={() => addPresetRole(role)}
                    disabled={selectedPresetRoles.includes(role.name)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPresetRoles.includes(role.name)
                        ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="font-medium">{role.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">Add Custom Role</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Enter role name"
                  className="flex-1 px-3 py-2 border rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && addCustomRole()}
                />
                <button
                  onClick={addCustomRole}
                  disabled={!newRoleName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">Current Roles ({roles.length})</h3>
              {roles.length === 0 ? (
                <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">
                  No roles added yet. Add at least one role to continue.
                </p>
              ) : (
                <div className="space-y-2">
                  {roles.map(role => (
                    <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: role.color }}
                        />
                        <span className="font-medium">{role.name}</span>
                      </div>
                      <button
                        onClick={() => removeRole(role.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Shift Templates</h3>
              <button
                onClick={addShiftTemplate}
                className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add Shift</span>
              </button>
            </div>

            {shiftTemplates.length === 0 ? (
              <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">
                No shift templates yet. Click "Add Shift" to create one.
              </p>
            ) : (
              <div className="space-y-4">
                {shiftTemplates.map((shift, shiftIndex) => (
                  <div key={shift.id} className="border rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Shift Name</label>
                        <input
                          type="text"
                          value={shift.name}
                          onChange={(e) => updateShiftTemplate(shift.id, { name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Start Time</label>
                        <input
                          type="time"
                          value={shift.startTime}
                          onChange={(e) => updateShiftTemplate(shift.id, { startTime: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">End Time</label>
                        <input
                          type="time"
                          value={shift.endTime}
                          onChange={(e) => updateShiftTemplate(shift.id, { endTime: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Role Requirements</label>
                        <button
                          onClick={() => addRoleRequirement(shift.id)}
                          disabled={roles.length === 0 || shift.roleRequirements.length >= roles.length}
                          className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                        >
                          + Add Role
                        </button>
                      </div>
                      
                      {shift.roleRequirements.length === 0 ? (
                        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                          No roles required. Add at least one role requirement.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {shift.roleRequirements.map((req, reqIndex) => (
                            <div key={reqIndex} className="flex items-center space-x-2">
                              <select
                                value={req.roleId}
                                onChange={(e) => updateRoleRequirement(shift.id, reqIndex, { roleId: e.target.value })}
                                className="flex-1 px-3 py-2 border rounded-lg"
                              >
                                {roles.map(role => (
                                  <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={req.count}
                                onChange={(e) => updateRoleRequirement(shift.id, reqIndex, { count: parseInt(e.target.value) || 1 })}
                                min="1"
                                className="w-20 px-3 py-2 border rounded-lg"
                              />
                              <button
                                onClick={() => removeRoleRequirement(shift.id, reqIndex)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {shiftTemplates.length > 1 && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setShiftTemplates(templates => templates.filter(t => t.id !== shift.id))}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          Remove Shift
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Weekly Schedule</h3>
              <p className="text-sm text-gray-500">
                Configure which days you're open and assign shifts
              </p>
            </div>

            <div className="space-y-4">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={weeklySchedule[day].enabled}
                        onChange={() => toggleDayEnabled(day)}
                        className="h-5 w-5 text-blue-600 rounded"
                      />
                      <h4 className="font-medium text-lg">{day}</h4>
                    </div>
                    
                    {weeklySchedule[day].enabled && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addShiftToDay(day, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="px-3 py-1 border rounded-lg text-sm"
                        defaultValue=""
                      >
                        <option value="">Add shift...</option>
                        {shiftTemplates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.startTime} - {template.endTime})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {weeklySchedule[day].enabled && (
                    <div className="space-y-2">
                      {weeklySchedule[day].shifts.length === 0 ? (
                        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                          No shifts scheduled. Add shifts from the dropdown above.
                        </p>
                      ) : (
                        weeklySchedule[day].shifts.map(shift => (
                          <div key={shift.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                            <div>
                              <p className="font-medium">{shift.name}</p>
                              <p className="text-sm text-gray-500">
                                {shift.startTime} - {shift.endTime}
                                {shift.roleRequirements.length > 0 && (
                                  <span className="ml-2">
                                    • {shift.roleRequirements.map(req => {
                                      const role = roles.find(r => r.id === req.roleId);
                                      return `${req.count} ${role?.name}`;
                                    }).join(', ')}
                                  </span>
                                )}
                              </p>
                            </div>
                            <button
                              onClick={() => removeShiftFromDay(day, shift.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Configuration Summary</h3>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Business Roles ({roles.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {roles.map(role => (
                      <span key={role.id} className="px-3 py-1 bg-white rounded-full text-sm">
                        {role.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Shift Templates ({shiftTemplates.length})</h4>
                  <div className="space-y-1">
                    {shiftTemplates.map(shift => (
                      <p key={shift.id} className="text-sm">
                        <strong>{shift.name}:</strong> {shift.startTime} - {shift.endTime}
                        {shift.roleRequirements.length > 0 && (
                          <span className="text-gray-500 ml-2">
                            ({shift.roleRequirements.map(req => {
                              const role = roles.find(r => r.id === req.roleId);
                              return `${req.count} ${role?.name}`;
                            }).join(', ')})
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Operating Days</h4>
                  <div className="space-y-1">
                    {DAYS_OF_WEEK.filter(day => weeklySchedule[day].enabled).map(day => (
                      <p key={day} className="text-sm">
                        <strong>{day}:</strong> {weeklySchedule[day].shifts.length} shifts scheduled
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">Ready to go!</p>
                    <p className="text-sm text-green-700 mt-1">
                      Your business is configured and ready to start scheduling. 
                      You can always modify these settings later.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Progress bar */}
        <div className="px-8 py-6 border-b">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}>
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {index < currentStep ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${index <= currentStep ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 hidden md:block">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 w-12 mx-4 transition-colors ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="px-8 py-6 border-t bg-gray-50 rounded-b-lg">
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={currentStep === 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                currentStep === 0 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceedToNextStep()}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  canProceedToNextStep() 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={saveConfiguration}
                disabled={saving || !canProceedToNextStep()}
                className={`flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors ${
                  canProceedToNextStep() && !saving
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Complete Setup</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;

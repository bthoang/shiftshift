import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Settings, Bell, CheckCircle, XCircle, User, Star, RefreshCw, Plus, Edit, Trash2, Save, X, LogOut, ArrowRight, CalendarDays, AlertTriangle, UserX, UserPlus, AlertCircle, ChevronRight } from 'lucide-react';

const EmployeeSchedulingSystem = () => {
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '', userType: 'employee' });

  // Sample users for demonstration - start with only admin/manager accounts
  const [users, setUsers] = useState([
    { id: 1, email: 'admin@company.com', password: 'admin', name: 'Admin User', role: 'admin', businessId: 1 },
    { id: 2, email: 'manager@company.com', password: 'manager', name: 'Manager User', role: 'manager', businessId: 1 }
  ]);

  // Business configurations - START WITH EMPTY CONFIGURATION
  const [businesses, setBusinesses] = useState([
    {
      id: 1,
      name: 'My Business',
      roles: [], // Empty - admin must set up
      dayConfigs: {
        0: { shifts: [] }, // Sunday
        1: { shifts: [] }, // Monday
        2: { shifts: [] }, // Tuesday
        3: { shifts: [] }, // Wednesday
        4: { shifts: [] }, // Thursday
        5: { shifts: [] }, // Friday
        6: { shifts: [] }  // Saturday
      },
      setupComplete: false // Track if initial setup is done
    }
  ]);

  // Workers - START WITH EMPTY LIST
  const [workers, setWorkers] = useState([]);

  // Schedule state
  const [schedule, setSchedule] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // UI state
  const [activeTab, setActiveTab] = useState('setup');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showScheduleGenerator, setShowScheduleGenerator] = useState(false);
  const [pendingSwaps, setPendingSwaps] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);

  // Setup wizard state
  const [setupStep, setSetupStep] = useState('welcome');
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Worker management state
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [newWorker, setNewWorker] = useState({
    name: '',
    email: '',
    rating: 5,
    roles: [],
    monthlyAvailability: {}
  });

  // Employee-specific state
  const [showSwapRequest, setShowSwapRequest] = useState(false);
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  const [selectedShiftForSwap, setSelectedShiftForSwap] = useState(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    startDate: '',
    endDate: '',
    type: 'unavailable',
    reason: ''
  });

  // Monthly availability state
  const [showMonthlyAvailability, setShowMonthlyAvailability] = useState(false);
  const [monthlyAvailabilityData, setMonthlyAvailabilityData] = useState({});
  const [editingMonth, setEditingMonth] = useState(new Date());

  // Shift editing state
  const [showShiftEditor, setShowShiftEditor] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  // Shift configuration state
  const [showShiftConfig, setShowShiftConfig] = useState(false);
  const [editingDayConfig, setEditingDayConfig] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1); // Monday by default

  // Role management state
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState({ name: '' });

  // Business template state
  const [showBusinessTemplates, setShowBusinessTemplates] = useState(false);

  const currentBusiness = businesses.find(b => b.id === (currentUser?.businessId || 1));
  const currentWorker = currentUser?.workerId ? workers.find(w => w.id === currentUser.workerId) : null;

  // Check if business setup is complete
  const isSetupComplete = () => {
    if (!currentBusiness) return false;
    
    // Must have at least one role
    if (currentBusiness.roles.length === 0) return false;
    
    // Must have at least one shift configured for at least one day
    const hasShifts = Object.values(currentBusiness.dayConfigs).some(
      dayConfig => dayConfig.shifts && dayConfig.shifts.length > 0
    );
    
    return hasShifts;
  };

  // Update setup status when roles or shifts change
  useEffect(() => {
    if (currentBusiness && currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager')) {
      const isComplete = isSetupComplete();
      if (currentBusiness.setupComplete !== isComplete) {
        const updatedBusinesses = businesses.map(b => 
          b.id === currentBusiness.id 
            ? { ...b, setupComplete: isComplete }
            : b
        );
        setBusinesses(updatedBusinesses);
      }
    }
  }, [currentBusiness?.roles, currentBusiness?.dayConfigs]);

  // Set initial tab based on user role and setup status
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'employee') {
        // Check if there are any workers configured and if the employee's worker exists
        const hasWorkers = workers.filter(w => w.businessId === currentUser.businessId).length > 0;
        const employeeWorkerExists = currentUser.workerId && workers.find(w => w.id === currentUser.workerId);
        
        if (!hasWorkers || !isSetupComplete() || !employeeWorkerExists) {
          setActiveTab('no-access');
        } else {
          setActiveTab('dashboard');
        }
      } else if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        if (!isSetupComplete()) {
          setActiveTab('setup');
          setShowSetupWizard(true);
        } else {
          setActiveTab('dashboard');
        }
      }
    }
  }, [currentUser, currentBusiness?.setupComplete, workers]);

  // Check if worker has submitted availability for a month
  const hasAvailabilityForMonth = (workerId, year, month) => {
    const worker = workers.find(w => w.id === workerId);
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    return worker?.monthlyAvailability?.[monthKey] !== undefined;
  };

  // Get worker availability for a specific date
  const getWorkerAvailabilityForDate = (workerId, dateStr) => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return true;

    const [year, month] = dateStr.split('-');
    const monthKey = `${year}-${month}`;
    const monthlyData = worker.monthlyAvailability?.[monthKey];
    
    if (!monthlyData) return false; // No availability submitted
    
    return monthlyData[dateStr] !== false;
  };

  // Login function
  const handleLogin = () => {
    const user = users.find(u => 
      u.email === loginForm.email && 
      u.password === loginForm.password
    );
    
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
    } else {
      alert('Invalid credentials');
    }
  };

  // Logout function
  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setLoginForm({ email: '', password: '', userType: 'employee' });
  };

  // Generate schedule algorithm with day-specific configurations
  const generateSchedule = (month, year) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const newSchedule = {};

    // Check if setup is complete
    if (!isSetupComplete()) {
      alert('Please complete the initial setup before generating schedules. You need to configure roles and shifts first.');
      setShowScheduleGenerator(false);
      return;
    }

    // Check if all workers have submitted availability
    const businessWorkers = workers.filter(w => w.businessId === currentUser.businessId);
    
    if (businessWorkers.length === 0) {
      alert('No workers have been added yet. Please add workers before generating a schedule.');
      setShowScheduleGenerator(false);
      return;
    }

    const workersWithoutAvailability = businessWorkers.filter(w => !hasAvailabilityForMonth(w.id, year, month));
    
    if (workersWithoutAvailability.length > 0) {
      alert(`Cannot generate schedule. The following workers need to submit their monthly availability: ${workersWithoutAvailability.map(w => w.name).join(', ')}`);
      setShowScheduleGenerator(false);
      return;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      
      newSchedule[dateStr] = [];

      // Get day-specific shift configuration
      const dayConfig = currentBusiness.dayConfigs[dayOfWeek];
      if (!dayConfig || !dayConfig.shifts || dayConfig.shifts.length === 0) continue;

      // Generate shifts for each time slot based on day configuration
      dayConfig.shifts.forEach((shiftTime, shiftIndex) => {
        const shift = {
          id: `${dateStr}-${shiftIndex}`,
          date: dateStr,
          shiftIndex,
          name: shiftTime.name,
          start: shiftTime.start,
          end: shiftTime.end,
          workers: [],
          openPositions: []
        };

        // Filter available workers for this date using monthly availability
        const availableWorkers = businessWorkers.filter(w => 
          getWorkerAvailabilityForDate(w.id, dateStr)
        );

        const assignedWorkers = [];
        let lowRatedCount = 0;

        // Process each role based on day-specific requirements
        currentBusiness.roles.forEach(role => {
          const requiredCount = shiftTime.roleRequirements[role.id] || 0;
          
          const roleWorkers = availableWorkers
            .filter(w => w.roles.includes(role.id) && !assignedWorkers.includes(w.id))
            .sort((a, b) => b.rating - a.rating); // Sort by rating (highest first)

          for (let i = 0; i < requiredCount; i++) {
            let assigned = false;
            
            // Try to assign workers, respecting the low-rating constraint
            for (const worker of roleWorkers) {
              if (assignedWorkers.includes(worker.id)) continue;
              
              // Check low-rating constraint (max 2 workers with rating ≤ 4 per shift)
              if (worker.rating <= 4 && lowRatedCount >= 2) continue;
              
              // Assign worker
              shift.workers.push({
                workerId: worker.id,
                workerName: worker.name,
                rating: worker.rating,
                roleId: role.id,
                roleName: role.name
              });
              
              assignedWorkers.push(worker.id);
              if (worker.rating <= 4) lowRatedCount++;
              assigned = true;
              break;
            }

            // If couldn't assign, create an open position
            if (!assigned && requiredCount > 0) {
              shift.openPositions.push({
                roleId: role.id,
                roleName: role.name,
                id: `open-${shift.id}-${role.id}-${i}`
              });
            }
          }
        });

        newSchedule[dateStr].push(shift);
      });
    }

    setSchedule(newSchedule);
    setShowScheduleGenerator(false);
    setNotifications([...notifications, {
      id: Date.now(),
      message: `Schedule generated for ${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      type: 'success',
      timestamp: new Date().toISOString()
    }]);
  };

  // Edit shift function
  const openShiftEditor = (shift, date) => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') return;
    
    setEditingShift({
      ...shift,
      date: date,
      availableWorkers: workers.filter(w => 
        w.businessId === currentUser.businessId && 
        getWorkerAvailabilityForDate(w.id, date)
      )
    });
    setShowShiftEditor(true);
  };

  // Update shift assignment for editing (updated to work with day-specific configs)
  const updateShiftAssignment = (workerId, roleId, action) => {
    if (!editingShift) return;

    const updatedShift = { ...editingShift };
    const worker = workers.find(w => w.id === workerId);
    const role = currentBusiness.roles.find(r => r.id === roleId);

    if (action === 'add') {
      // Check if worker can fill this role
      if (!worker.roles.includes(roleId)) {
        alert(`${worker.name} is not qualified for the ${role.name} role.`);
        return;
      }

      // Check if worker is already assigned to this shift
      if (updatedShift.workers.some(w => w.workerId === workerId)) {
        alert(`${worker.name} is already assigned to this shift.`);
        return;
      }

      // Check low-rating constraint
      const currentLowRatedCount = updatedShift.workers.filter(w => w.rating <= 4).length;
      if (worker.rating <= 4 && currentLowRatedCount >= 2) {
        alert('Cannot assign more than 2 workers with rating ≤ 4 per shift.');
        return;
      }

      // Add worker
      updatedShift.workers.push({
        workerId: worker.id,
        workerName: worker.name,
        rating: worker.rating,
        roleId: roleId,
        roleName: role.name
      });

      // Remove from open positions if exists
      updatedShift.openPositions = updatedShift.openPositions.filter(op => 
        !(op.roleId === roleId)
      );

    } else if (action === 'remove') {
      // Remove worker
      updatedShift.workers = updatedShift.workers.filter(w => w.workerId !== workerId);

      // Get day-specific requirements
      const date = new Date(updatedShift.date);
      const dayOfWeek = date.getDay();
      const dayConfig = currentBusiness.dayConfigs[dayOfWeek];
      const shiftConfig = dayConfig?.shifts[updatedShift.shiftIndex];
      
      if (shiftConfig) {
        const roleCount = updatedShift.workers.filter(w => w.roleId === roleId).length;
        const requiredCount = shiftConfig.roleRequirements[roleId] || 0;
        
        if (roleCount < requiredCount) {
          updatedShift.openPositions.push({
            roleId: roleId,
            roleName: role.name,
            id: `open-${updatedShift.id}-${roleId}-${Date.now()}`
          });
        }
      }
    }

    setEditingShift(updatedShift);
  };

  // Shift configuration functions
  const updateDayConfig = (dayOfWeek, newConfig) => {
    const updatedBusinesses = businesses.map(business => {
      if (business.id === currentUser.businessId) {
        return {
          ...business,
          dayConfigs: {
            ...business.dayConfigs,
            [dayOfWeek]: newConfig
          }
        };
      }
      return business;
    });
    setBusinesses(updatedBusinesses);
    
    setNotifications([...notifications, {
      id: Date.now(),
      message: `Configuration updated for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`,
      type: 'success',
      timestamp: new Date().toISOString()
    }]);
  };

  const addShiftToDay = (dayOfWeek) => {
    const dayConfig = currentBusiness.dayConfigs[dayOfWeek];
    const newShift = {
      name: 'New Shift',
      start: '09:00',
      end: '17:00',
      roleRequirements: currentBusiness.roles.reduce((acc, role) => {
        acc[role.id] = 1;
        return acc;
      }, {})
    };

    const updatedConfig = {
      ...dayConfig,
      shifts: [...(dayConfig?.shifts || []), newShift]
    };

    updateDayConfig(dayOfWeek, updatedConfig);
  };

  const removeShiftFromDay = (dayOfWeek, shiftIndex) => {
    const dayConfig = currentBusiness.dayConfigs[dayOfWeek];
    const updatedConfig = {
      ...dayConfig,
      shifts: dayConfig.shifts.filter((_, index) => index !== shiftIndex)
    };

    updateDayConfig(dayOfWeek, updatedConfig);
  };

  const updateShiftInDay = (dayOfWeek, shiftIndex, updatedShift) => {
    const dayConfig = currentBusiness.dayConfigs[dayOfWeek];
    const updatedShifts = [...dayConfig.shifts];
    updatedShifts[shiftIndex] = updatedShift;

    const updatedConfig = {
      ...dayConfig,
      shifts: updatedShifts
    };

    updateDayConfig(dayOfWeek, updatedConfig);
  };

  // Role management functions
  const addRole = () => {
    if (!newRole.name.trim()) return;

    const maxId = Math.max(...currentBusiness.roles.map(r => r.id), 0);
    const role = {
      id: maxId + 1,
      name: newRole.name.trim()
    };

    const updatedBusinesses = businesses.map(business => {
      if (business.id === currentUser.businessId) {
        return {
          ...business,
          roles: [...business.roles, role]
        };
      }
      return business;
    });

    setBusinesses(updatedBusinesses);
    setNewRole({ name: '' });
    
    setNotifications([...notifications, {
      id: Date.now(),
      message: `Role "${role.name}" added successfully`,
      type: 'success',
      timestamp: new Date().toISOString()
    }]);
  };

  const updateRole = (roleId, newName) => {
    if (!newName.trim()) return;

    const updatedBusinesses = businesses.map(business => {
      if (business.id === currentUser.businessId) {
        return {
          ...business,
          roles: business.roles.map(role => 
            role.id === roleId ? { ...role, name: newName.trim() } : role
          )
        };
      }
      return business;
    });

    setBusinesses(updatedBusinesses);
    setEditingRole(null);
    
    setNotifications([...notifications, {
      id: Date.now(),
      message: `Role updated successfully`,
      type: 'success',
      timestamp: new Date().toISOString()
    }]);
  };

  const deleteRole = (roleId) => {
    // Check if role is in use by workers
    const roleInUse = workers.some(worker => 
      worker.businessId === currentUser.businessId && worker.roles.includes(roleId)
    );

    if (roleInUse) {
      alert('Cannot delete this role as it is assigned to workers. Please reassign workers first.');
      return;
    }

    const updatedBusinesses = businesses.map(business => {
      if (business.id === currentUser.businessId) {
        const updatedBusiness = {
          ...business,
          roles: business.roles.filter(role => role.id !== roleId)
        };

        // Remove role from all day configurations
        const updatedDayConfigs = {};
        Object.keys(business.dayConfigs).forEach(day => {
          const dayConfig = business.dayConfigs[day];
          updatedDayConfigs[day] = {
            ...dayConfig,
            shifts: dayConfig.shifts.map(shift => ({
              ...shift,
              roleRequirements: Object.fromEntries(
                Object.entries(shift.roleRequirements).filter(([id]) => parseInt(id) !== roleId)
              )
            }))
          };
        });

        return {
          ...updatedBusiness,
          dayConfigs: updatedDayConfigs
        };
      }
      return business;
    });

    setBusinesses(updatedBusinesses);
    
    setNotifications([...notifications, {
      id: Date.now(),
      message: `Role deleted successfully`,
      type: 'success',
      timestamp: new Date().toISOString()
    }]);
  };

  // Business template functions
  const businessTemplates = {
    restaurant: {
      name: 'Restaurant',
      roles: [
        { id: 1, name: 'Server' },
        { id: 2, name: 'Cook' },
        { id: 3, name: 'Manager' },
        { id: 4, name: 'Host' },
        { id: 5, name: 'Dishwasher' }
      ],
      dayConfigs: {
        0: { shifts: [{ name: 'Brunch', start: '10:00', end: '16:00', roleRequirements: { 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 } }, { name: 'Dinner', start: '16:00', end: '22:00', roleRequirements: { 1: 4, 2: 2, 3: 1, 4: 1, 5: 1 } }] },
        1: { shifts: [{ name: 'Lunch', start: '11:00', end: '16:00', roleRequirements: { 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 } }, { name: 'Dinner', start: '16:00', end: '22:00', roleRequirements: { 1: 4, 2: 2, 3: 1, 4: 1, 5: 1 } }] },
        2: { shifts: [{ name: 'Lunch', start: '11:00', end: '16:00', roleRequirements: { 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 } }, { name: 'Dinner', start: '16:00', end: '22:00', roleRequirements: { 1: 4, 2: 2, 3: 1, 4: 1, 5: 1 } }] },
        3: { shifts: [{ name: 'Lunch', start: '11:00', end: '16:00', roleRequirements: { 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 } }, { name: 'Dinner', start: '16:00', end: '22:00', roleRequirements: { 1: 4, 2: 2, 3: 1, 4: 1, 5: 1 } }] },
        4: { shifts: [{ name: 'Lunch', start: '11:00', end: '16:00', roleRequirements: { 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 } }, { name: 'Dinner', start: '16:00', end: '22:00', roleRequirements: { 1: 4, 2: 2, 3: 1, 4: 1, 5: 1 } }] },
        5: { shifts: [{ name: 'Lunch', start: '11:00', end: '16:00', roleRequirements: { 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 } }, { name: 'Dinner', start: '16:00', end: '22:00', roleRequirements: { 1: 5, 2: 3, 3: 1, 4: 2, 5: 1 } }] },
        6: { shifts: [{ name: 'Brunch', start: '10:00', end: '16:00', roleRequirements: { 1: 4, 2: 2, 3: 1, 4: 2, 5: 1 } }, { name: 'Dinner', start: '16:00', end: '22:00', roleRequirements: { 1: 5, 2: 3, 3: 1, 4: 2, 5: 1 } }] }
      }
    },
    coffee_shop: {
      name: 'Coffee Shop',
      roles: [
        { id: 1, name: 'Shift Lead' },
        { id: 2, name: 'Barista' },
        { id: 3, name: 'Cashier' }
      ],
      dayConfigs: {
        0: { shifts: [{ name: 'Morning', start: '07:00', end: '14:00', roleRequirements: { 1: 1, 2: 2, 3: 1 } }, { name: 'Afternoon', start: '14:00', end: '20:00', roleRequirements: { 1: 1, 2: 1, 3: 1 } }] },
        1: { shifts: [{ name: 'Morning Rush', start: '06:00', end: '11:00', roleRequirements: { 1: 1, 2: 3, 3: 2 } }, { name: 'Afternoon', start: '11:00', end: '17:00', roleRequirements: { 1: 1, 2: 2, 3: 1 } }, { name: 'Evening', start: '17:00', end: '21:00', roleRequirements: { 1: 0, 2: 1, 3: 1 } }] },
        2: { shifts: [{ name: 'Morning Rush', start: '06:00', end: '11:00', roleRequirements: { 1: 1, 2: 3, 3: 2 } }, { name: 'Afternoon', start: '11:00', end: '17:00', roleRequirements: { 1: 1, 2: 2, 3: 1 } }, { name: 'Evening', start: '17:00', end: '21:00', roleRequirements: { 1: 0, 2: 1, 3: 1 } }] },
        3: { shifts: [{ name: 'Morning Rush', start: '06:00', end: '11:00', roleRequirements: { 1: 1, 2: 3, 3: 2 } }, { name: 'Afternoon', start: '11:00', end: '17:00', roleRequirements: { 1: 1, 2: 2, 3: 1 } }, { name: 'Evening', start: '17:00', end: '21:00', roleRequirements: { 1: 0, 2: 1, 3: 1 } }] },
        4: { shifts: [{ name: 'Morning Rush', start: '06:00', end: '11:00', roleRequirements: { 1: 1, 2: 3, 3: 2 } }, { name: 'Afternoon', start: '11:00', end: '17:00', roleRequirements: { 1: 1, 2: 2, 3: 1 } }, { name: 'Evening', start: '17:00', end: '21:00', roleRequirements: { 1: 0, 2: 1, 3: 1 } }] },
        5: { shifts: [{ name: 'Morning Rush', start: '06:00', end: '11:00', roleRequirements: { 1: 1, 2: 3, 3: 2 } }, { name: 'Afternoon', start: '11:00', end: '17:00', roleRequirements: { 1: 1, 2: 2, 3: 1 } }, { name: 'Evening', start: '17:00', end: '21:00', roleRequirements: { 1: 0, 2: 1, 3: 1 } }] },
        6: { shifts: [{ name: 'Morning', start: '07:00', end: '14:00', roleRequirements: { 1: 1, 2: 2, 3: 1 } }, { name: 'Afternoon', start: '14:00', end: '20:00', roleRequirements: { 1: 1, 2: 1, 3: 1 } }] }
      }
    },
    retail_store: {
      name: 'Retail Store',
      roles: [
        { id: 1, name: 'Store Manager' },
        { id: 2, name: 'Sales Associate' },
        { id: 3, name: 'Cashier' },
        { id: 4, name: 'Stock Associate' }
      ],
      dayConfigs: {
        0: { shifts: [{ name: 'Day Shift', start: '10:00', end: '18:00', roleRequirements: { 1: 1, 2: 2, 3: 1, 4: 1 } }] },
        1: { shifts: [{ name: 'Opening', start: '09:00', end: '15:00', roleRequirements: { 1: 1, 2: 2, 3: 1, 4: 1 } }, { name: 'Closing', start: '15:00', end: '21:00', roleRequirements: { 1: 1, 2: 2, 3: 1, 4: 1 } }] },
        2: { shifts: [{ name: 'Opening', start: '09:00', end: '15:00', roleRequirements: { 1: 1, 2: 2, 3: 1, 4: 1 } }, { name: 'Closing', start: '15:00', end: '21:00', roleRequirements: { 1: 1, 2: 2, 3: 1, 4: 1 } }] },
        3: { shifts: [{ name: 'Opening', start: '09:00', end: '15:00', roleRequirements: { 1: 1, 2: 2, 3: 1, 4: 1 } }, { name: 'Closing', start: '15:00', end: '21:00', roleRequirements: { 1: 1, 2: 2, 3: 1, 4: 1 } }] },
        4: { shifts: [{ name: 'Opening', start: '09:00', end: '15:00', roleRequirements: { 1: 1, 2: 2, 3: 1, 4: 1 } }, { name: 'Closing', start: '15:00', end: '21:00', roleRequirements: { 1: 1, 2: 2, 3: 1, 4: 1 } }] },
        5: { shifts: [{ name: 'Opening', start: '09:00', end: '15:00', roleRequirements: { 1: 1, 2: 3, 3: 2, 4: 1 } }, { name: 'Closing', start: '15:00', end: '21:00', roleRequirements: { 1: 1, 2: 3, 3: 2, 4: 1 } }] },
        6: { shifts: [{ name: 'Opening', start: '09:00', end: '15:00', roleRequirements: { 1: 1, 2: 3, 3: 2, 4: 1 } }, { name: 'Closing', start: '15:00', end: '21:00', roleRequirements: { 1: 1, 2: 3, 3: 2, 4: 1 } }] }
      }
    },
    healthcare: {
      name: 'Healthcare Facility',
      roles: [
        { id: 1, name: 'Nurse' },
        { id: 2, name: 'Doctor' },
        { id: 3, name: 'Receptionist' },
        { id: 4, name: 'Technician' }
      ],
      dayConfigs: {
        0: { shifts: [{ name: 'Day', start: '07:00', end: '19:00', roleRequirements: { 1: 2, 2: 1, 3: 1, 4: 1 } }, { name: 'Night', start: '19:00', end: '07:00', roleRequirements: { 1: 1, 2: 1, 3: 0, 4: 0 } }] },
        1: { shifts: [{ name: 'Day', start: '07:00', end: '19:00', roleRequirements: { 1: 3, 2: 2, 3: 2, 4: 2 } }, { name: 'Night', start: '19:00', end: '07:00', roleRequirements: { 1: 1, 2: 1, 3: 0, 4: 0 } }] },
        2: { shifts: [{ name: 'Day', start: '07:00', end: '19:00', roleRequirements: { 1: 3, 2: 2, 3: 2, 4: 2 } }, { name: 'Night', start: '19:00', end: '07:00', roleRequirements: { 1: 1, 2: 1, 3: 0, 4: 0 } }] },
        3: { shifts: [{ name: 'Day', start: '07:00', end: '19:00', roleRequirements: { 1: 3, 2: 2, 3: 2, 4: 2 } }, { name: 'Night', start: '19:00', end: '07:00', roleRequirements: { 1: 1, 2: 1, 3: 0, 4: 0 } }] },
        4: { shifts: [{ name: 'Day', start: '07:00', end: '19:00', roleRequirements: { 1: 3, 2: 2, 3: 2, 4: 2 } }, { name: 'Night', start: '19:00', end: '07:00', roleRequirements: { 1: 1, 2: 1, 3: 0, 4: 0 } }] },
        5: { shifts: [{ name: 'Day', start: '07:00', end: '19:00', roleRequirements: { 1: 3, 2: 2, 3: 2, 4: 2 } }, { name: 'Night', start: '19:00', end: '07:00', roleRequirements: { 1: 1, 2: 1, 3: 0, 4: 0 } }] },
        6: { shifts: [{ name: 'Day', start: '07:00', end: '19:00', roleRequirements: { 1: 2, 2: 1, 3: 1, 4: 1 } }, { name: 'Night', start: '19:00', end: '07:00', roleRequirements: { 1: 1, 2: 1, 3: 0, 4: 0 } }] }
      }
    }
  };

  const applyBusinessTemplate = (templateKey) => {
    const template = businessTemplates[templateKey];
    if (!template) return;

    const updatedBusinesses = businesses.map(business => {
      if (business.id === currentUser.businessId) {
        return {
          ...business,
          roles: template.roles,
          dayConfigs: template.dayConfigs
        };
      }
      return business;
    });

    setBusinesses(updatedBusinesses);
    setShowBusinessTemplates(false);
    
    // Clear worker roles that no longer exist
    const newRoleIds = template.roles.map(r => r.id);
    const updatedWorkers = workers.map(worker => {
      if (worker.businessId === currentUser.businessId) {
        return {
          ...worker,
          roles: worker.roles.filter(roleId => newRoleIds.includes(roleId))
        };
      }
      return worker;
    });
    setWorkers(updatedWorkers);
    
    setNotifications([...notifications, {
      id: Date.now(),
      message: `Applied ${template.name} template successfully`,
      type: 'success',
      timestamp: new Date().toISOString()
    }]);
  };

  // Save shift changes
  const saveShiftChanges = () => {
    if (!editingShift) return;

    const updatedSchedule = { ...schedule };
    const dayShifts = updatedSchedule[editingShift.date];
    const shiftIndex = dayShifts.findIndex(s => s.id === editingShift.id);
    
    if (shiftIndex !== -1) {
      dayShifts[shiftIndex] = {
        ...editingShift,
        availableWorkers: undefined // Remove this helper property
      };
    }
    
    setSchedule(updatedSchedule);
    setShowShiftEditor(false);
    setEditingShift(null);
    
    setNotifications([...notifications, {
      id: Date.now(),
      message: `Shift updated for ${new Date(editingShift.date).toLocaleDateString()}`,
      type: 'success',
      timestamp: new Date().toISOString()
    }]);
  };

  // Submit monthly availability
  const submitMonthlyAvailability = () => {
    if (!currentWorker) return;

    const year = editingMonth.getFullYear();
    const month = editingMonth.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const updatedWorkers = workers.map(worker => {
      if (worker.id === currentWorker.id) {
        return {
          ...worker,
          monthlyAvailability: {
            ...worker.monthlyAvailability,
            [monthKey]: { ...monthlyAvailabilityData }
          }
        };
      }
      return worker;
    });

    setWorkers(updatedWorkers);
    setShowMonthlyAvailability(false);
    setNotifications([...notifications, {
      id: Date.now(),
      message: `Availability submitted for ${editingMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      type: 'success',
      timestamp: new Date().toISOString()
    }]);
  };

  // Get my shifts (employee view)
  const getMyShifts = () => {
    if (!currentWorker) return [];
    
    const myShifts = [];
    Object.entries(schedule).forEach(([date, shifts]) => {
      shifts.forEach(shift => {
        const myAssignment = shift.workers.find(w => w.workerId === currentWorker.id);
        if (myAssignment) {
          myShifts.push({
            ...shift,
            date,
            myRole: myAssignment.roleName
          });
        }
      });
    });
    
    return myShifts.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Get available open shifts for pickup
  const getOpenShifts = () => {
    if (!currentWorker) return [];
    
    const openShifts = [];
    Object.entries(schedule).forEach(([date, shifts]) => {
      shifts.forEach(shift => {
        shift.openPositions.forEach(openPos => {
          // Check if current worker can fill this role
          if (currentWorker.roles.includes(openPos.roleId)) {
            // Check availability
            if (getWorkerAvailabilityForDate(currentWorker.id, date)) {
              openShifts.push({
                ...shift,
                date,
                openPosition: openPos,
                canPickup: true
              });
            }
          }
        });
      });
    });
    
    return openShifts.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Pick up open shift
  const pickupOpenShift = (shift, openPosition) => {
    const updatedSchedule = { ...schedule };
    const dayShifts = updatedSchedule[shift.date];
    const shiftIndex = dayShifts.findIndex(s => s.id === shift.id);
    
    if (shiftIndex !== -1) {
      // Remove from open positions
      dayShifts[shiftIndex].openPositions = dayShifts[shiftIndex].openPositions
        .filter(op => op.id !== openPosition.id);
      
      // Add to workers
      dayShifts[shiftIndex].workers.push({
        workerId: currentWorker.id,
        workerName: currentWorker.name,
        rating: currentWorker.rating,
        roleId: openPosition.roleId,
        roleName: openPosition.roleName
      });
    }
    
    setSchedule(updatedSchedule);
    setNotifications([...notifications, {
      id: Date.now(),
      message: `You picked up ${shift.name} shift on ${new Date(shift.date).toLocaleDateString()}`,
      type: 'success',
      timestamp: new Date().toISOString()
    }]);
  };

  // Request shift swap
  const requestShiftSwap = (myShift, targetWorker) => {
    const swapRequest = {
      id: Date.now(),
      fromWorkerId: currentWorker.id,
      fromWorkerName: currentWorker.name,
      toWorkerId: targetWorker.workerId,
      toWorkerName: targetWorker.workerName,
      shiftId: myShift.id,
      shiftName: myShift.name,
      shiftDate: myShift.date,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };
    
    setPendingSwaps([...pendingSwaps, swapRequest]);
    setNotifications([...notifications, {
      id: Date.now(),
      message: `Shift swap requested with ${targetWorker.workerName}`,
      type: 'info',
      timestamp: new Date().toISOString()
    }]);
    setShowSwapRequest(false);
  };

  // Submit availability/time-off request
  const submitAvailabilityRequest = () => {
    if (!availabilityForm.startDate || !availabilityForm.endDate) return;
    
    const request = {
      id: Date.now(),
      workerId: currentWorker.id,
      workerName: currentWorker.name,
      startDate: availabilityForm.startDate,
      endDate: availabilityForm.endDate,
      type: availabilityForm.type,
      reason: availabilityForm.reason,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    
    setTimeOffRequests([...timeOffRequests, request]);
    setNotifications([...notifications, {
      id: Date.now(),
      message: `${availabilityForm.type === 'unavailable' ? 'Time-off' : 'Availability'} request submitted`,
      type: 'info',
      timestamp: new Date().toISOString()
    }]);
    
    setShowAvailabilityForm(false);
    setAvailabilityForm({ startDate: '', endDate: '', type: 'unavailable', reason: '' });
  };

  // Approve/reject swap
  const handleSwapDecision = (swapId, approved) => {
    const swap = pendingSwaps.find(s => s.id === swapId);
    if (!swap) return;

    if (approved) {
      setNotifications([...notifications, {
        id: Date.now(),
        message: `Shift swap approved and completed`,
        type: 'success',
        timestamp: new Date().toISOString()
      }]);
    }

    setPendingSwaps(pendingSwaps.map(s => 
      s.id === swapId 
        ? { ...s, status: approved ? 'approved' : 'rejected' }
        : s
    ));
  };

  // Approve/reject time-off
  const handleTimeOffDecision = (requestId, approved) => {
    const request = timeOffRequests.find(r => r.id === requestId);
    if (!request) return;

    setTimeOffRequests(timeOffRequests.map(r => 
      r.id === requestId 
        ? { ...r, status: approved ? 'approved' : 'rejected' }
        : r
    ));

    setNotifications([...notifications, {
      id: Date.now(),
      message: `Time-off request ${approved ? 'approved' : 'rejected'}`,
      type: approved ? 'success' : 'error',
      timestamp: new Date().toISOString()
    }]);
  };

  // Get dates for current month
  const getDatesInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const dates = [];

    // Calculate first day of calendar (might be from previous month)
    const startDay = new Date(firstDay);
    startDay.setDate(startDay.getDate() - firstDay.getDay());

    // Get 42 days (6 weeks) for a complete calendar grid
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDay);
      date.setDate(startDay.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  // Initialize monthly availability for editing
  const initializeMonthlyAvailability = (month) => {
    if (!currentWorker) return;
    
    setEditingMonth(month);
    const year = month.getFullYear();
    const monthNum = month.getMonth();
    const monthKey = `${year}-${String(monthNum + 1).padStart(2, '0')}`;
    
    // Get existing availability or initialize with all available
    const existingAvailability = currentWorker?.monthlyAvailability?.[monthKey] || {};
    
    const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
    const newAvailability = {};
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      newAvailability[dateStr] = existingAvailability[dateStr] !== undefined ? existingAvailability[dateStr] : true;
    }
    
    setMonthlyAvailabilityData(newAvailability);
    setShowMonthlyAvailability(true);
  };

  // Create worker account
  const createWorkerAccount = (worker) => {
    // Generate email from worker name
    const email = `${worker.name.toLowerCase().replace(/\s+/g, '.')}@company.com`;
    const password = worker.name.split(' ')[0].toLowerCase(); // First name as password
    
    const newUser = {
      id: users.length + 1,
      email,
      password,
      name: worker.name,
      role: 'employee',
      businessId: worker.businessId,
      workerId: worker.id
    };
    
    // In a real system, you would update the users state here
    // For demo purposes, we'll just show the credentials
    alert(`Worker account created!\nEmail: ${email}\nPassword: ${password}\n\nPlease share these credentials with ${worker.name}`);
  };

  // Navigation based on current user role
  const getNavItems = () => {
    if (currentUser?.role === 'employee') {
      // Check if setup is complete and employee has valid worker profile
      const employeeWorkerExists = currentUser.workerId && workers.find(w => w.id === currentUser.workerId);
      if (!isSetupComplete() || !employeeWorkerExists) {
        return [];
      }
      return [
        { id: 'dashboard', label: 'My Dashboard', icon: Calendar },
        { id: 'schedule', label: 'Schedule', icon: Clock },
        { id: 'availability', label: 'My Availability', icon: CalendarDays },
        { id: 'openShifts', label: 'Open Shifts', icon: Plus },
        { id: 'requests', label: 'My Requests', icon: Bell }
      ];
    }

    const baseItems = [];

    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
      if (!isSetupComplete()) {
        baseItems.push({ id: 'setup', label: 'Initial Setup', icon: Settings, highlight: true });
      } else {
        baseItems.push(
          { id: 'dashboard', label: 'Dashboard', icon: Calendar },
          { id: 'schedule', label: 'Schedule', icon: Clock }
        );
      }
      
      baseItems.push(
        { id: 'shiftConfig', label: 'Shift Configuration', icon: Settings },
        { id: 'workers', label: 'Workers', icon: Users },
        { id: 'approvals', label: 'Approvals', icon: CheckCircle }
      );
    }

    if (currentUser?.role === 'admin') {
      baseItems.push({ id: 'settings', label: 'Settings', icon: Settings });
    }

    return baseItems;
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-8">
            <Calendar className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">ShiftSmart</h1>
            <p className="text-gray-600">Employee Scheduling System</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Enter your password"
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Login
            </button>
          </div>

          <div className="mt-6 text-sm text-gray-600">
            <p className="font-medium mb-2">Demo Accounts:</p>
            <div className="space-y-1">
              <p><strong>Admin:</strong> admin@company.com / admin</p>
              <p><strong>Manager:</strong> manager@company.com / manager</p>
              <p className="text-xs text-gray-500 mt-2">
                Employee accounts are created by admin/manager during setup
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">ShiftSmart</h1>
                <p className="text-sm text-gray-500">{currentBusiness?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="h-6 w-6 text-gray-400" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <User className="h-6 w-6 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{currentUser.name}</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-600"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-sm h-[calc(100vh-73px)] overflow-y-auto">
          <div className="p-4">
            <ul className="space-y-2">
              {getNavItems().map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-left transition-colors ${
                      activeTab === item.id
                        ? 'bg-blue-100 text-blue-700'
                        : item.highlight
                        ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {item.highlight && (
                      <span className="ml-auto text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full">
                        Required
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* No Access Message for Employees */}
          {activeTab === 'no-access' && currentUser.role === 'employee' && (
            <div className="max-w-2xl mx-auto mt-12">
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {!isSetupComplete() ? 'System Not Ready' : 'Account Not Found'}
                </h2>
                <p className="text-gray-600 mb-6">
                  {!isSetupComplete() 
                    ? 'The scheduling system is not yet configured. Please contact your manager or administrator to complete the initial setup.'
                    : 'Your employee account is not properly linked to a worker profile. Please contact your manager or administrator.'}
                </p>
                <div className="bg-yellow-50 rounded-lg p-4 text-left">
                  <h3 className="font-medium text-yellow-900 mb-2">What needs to be done:</h3>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {!isSetupComplete() ? (
                      <>
                        <li>• Job roles need to be configured</li>
                        <li>• Shift schedules need to be set up</li>
                        <li>• Workers need to be added to the system</li>
                      </>
                    ) : (
                      <>
                        <li>• Your account needs to be linked to a worker profile</li>
                        <li>• Contact your manager to resolve this issue</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Setup Wizard for Admin/Manager */}
          {activeTab === 'setup' && (currentUser.role === 'admin' || currentUser.role === 'manager') && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to ShiftSmart!</h2>
                  <p className="text-lg text-gray-600">
                    Let's set up your scheduling system. This wizard will guide you through the initial configuration.
                  </p>
                </div>

                {/* Setup Progress */}
                <div className="mb-8">
                  <div className="flex items-center space-x-4">
                    <div className={`flex items-center ${currentBusiness.roles.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        currentBusiness.roles.length > 0 ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'
                      }`}>
                        {currentBusiness.roles.length > 0 ? <CheckCircle className="h-5 w-5" /> : '1'}
                      </div>
                      <span className="ml-2 font-medium">Job Roles</span>
                    </div>
                    
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                    
                    <div className={`flex items-center ${
                      Object.values(currentBusiness.dayConfigs).some(d => d.shifts?.length > 0) 
                        ? 'text-green-600' 
                        : 'text-gray-400'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        Object.values(currentBusiness.dayConfigs).some(d => d.shifts?.length > 0)
                          ? 'bg-green-600 border-green-600 text-white' 
                          : 'border-gray-300'
                      }`}>
                        {Object.values(currentBusiness.dayConfigs).some(d => d.shifts?.length > 0) 
                          ? <CheckCircle className="h-5 w-5" /> 
                          : '2'}
                      </div>
                      <span className="ml-2 font-medium">Shift Configuration</span>
                    </div>
                    
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                    
                    <div className={`flex items-center ${
                      workers.filter(w => w.businessId === currentUser.businessId).length > 0 
                        ? 'text-green-600' 
                        : 'text-gray-400'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        workers.filter(w => w.businessId === currentUser.businessId).length > 0
                          ? 'bg-green-600 border-green-600 text-white' 
                          : 'border-gray-300'
                      }`}>
                        {workers.filter(w => w.businessId === currentUser.businessId).length > 0 
                          ? <CheckCircle className="h-5 w-5" /> 
                          : '3'}
                      </div>
                      <span className="ml-2 font-medium">Add Workers</span>
                    </div>
                  </div>
                </div>

                {/* Setup Steps */}
                <div className="space-y-6">
                  {/* Step 1: Job Roles */}
                  <div className={`border rounded-lg p-6 ${
                    currentBusiness.roles.length === 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          Step 1: Configure Job Roles
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Define the job positions in your business (e.g., Server, Cook, Manager)
                        </p>
                        {currentBusiness.roles.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {currentBusiness.roles.map(role => (
                              <span key={role.id} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                                {role.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        {currentBusiness.roles.length === 0 ? (
                          <span className="text-orange-600 text-sm font-medium">Required</span>
                        ) : (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => setShowRoleManager(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        {currentBusiness.roles.length === 0 ? 'Configure Roles' : 'Edit Roles'}
                      </button>
                      {currentBusiness.roles.length === 0 && (
                        <button
                          onClick={() => setShowBusinessTemplates(true)}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                        >
                          Use Template
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Shift Configuration */}
                  <div className={`border rounded-lg p-6 ${
                    currentBusiness.roles.length > 0 && !Object.values(currentBusiness.dayConfigs).some(d => d.shifts?.length > 0)
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200'
                  } ${currentBusiness.roles.length === 0 ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          Step 2: Configure Shifts
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Set up daily shift schedules and staffing requirements
                        </p>
                        {Object.values(currentBusiness.dayConfigs).some(d => d.shifts?.length > 0) && (
                          <p className="text-green-600 text-sm">
                            ✓ Shifts configured for {Object.values(currentBusiness.dayConfigs).filter(d => d.shifts?.length > 0).length} days
                          </p>
                        )}
                      </div>
                      <div>
                        {Object.values(currentBusiness.dayConfigs).some(d => d.shifts?.length > 0) ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : currentBusiness.roles.length > 0 ? (
                          <span className="text-orange-600 text-sm font-medium">Required</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={() => currentBusiness.roles.length > 0 && setActiveTab('shiftConfig')}
                      className={`px-4 py-2 rounded-lg ${
                        currentBusiness.roles.length > 0
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={currentBusiness.roles.length === 0}
                    >
                      Configure Shifts
                    </button>
                  </div>

                  {/* Step 3: Add Workers */}
                  <div className={`border rounded-lg p-6 ${
                    isSetupComplete() && workers.filter(w => w.businessId === currentUser.businessId).length === 0
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200'
                  } ${!isSetupComplete() ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          Step 3: Add Workers
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Add your employees to the system
                        </p>
                        {workers.filter(w => w.businessId === currentUser.businessId).length > 0 && (
                          <p className="text-green-600 text-sm">
                            ✓ {workers.filter(w => w.businessId === currentUser.businessId).length} workers added
                          </p>
                        )}
                      </div>
                      <div>
                        {workers.filter(w => w.businessId === currentUser.businessId).length > 0 ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : isSetupComplete() ? (
                          <span className="text-orange-600 text-sm font-medium">Required</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={() => isSetupComplete() && setActiveTab('workers')}
                      className={`px-4 py-2 rounded-lg ${
                        isSetupComplete()
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={!isSetupComplete()}
                    >
                      Manage Workers
                    </button>
                  </div>
                </div>

                {/* Complete Setup Button */}
                {isSetupComplete() && workers.filter(w => w.businessId === currentUser.businessId).length > 0 && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 text-lg font-medium"
                    >
                      Complete Setup & Go to Dashboard
                    </button>
                  </div>
                )}

                {/* Demo Setup Button (for testing) */}
                {currentBusiness.roles.length === 0 && (
                  <div className="mt-6 text-center border-t pt-6">
                    <p className="text-sm text-gray-600 mb-3">Want to try the system quickly?</p>
                    <button
                      onClick={() => {
                        // Apply restaurant template
                        applyBusinessTemplate('restaurant');
                        
                        // Add demo workers after a short delay to ensure roles are set
                        setTimeout(() => {
                          const demoWorkers = [
                            { name: 'Alice Johnson', rating: 9, roles: [1, 3], email: 'alice@company.com' },
                            { name: 'Bob Smith', rating: 7, roles: [2], email: 'bob@company.com' },
                            { name: 'Carol Davis', rating: 3, roles: [1], email: 'carol@company.com' },
                            { name: 'David Wilson', rating: 8, roles: [1, 2], email: 'david@company.com' },
                            { name: 'Eva Brown', rating: 5, roles: [1, 4], email: 'eva@company.com' }
                          ];
                          
                          const newWorkers = [];
                          const newUsers = [...users];
                          
                          demoWorkers.forEach((worker, index) => {
                            const workerId = Date.now() + index;
                            newWorkers.push({
                              id: workerId,
                              name: worker.name,
                              rating: worker.rating,
                              roles: worker.roles,
                              email: worker.email,
                              businessId: currentUser.businessId,
                              monthlyAvailability: {}
                            });
                            
                            // Create user account
                            newUsers.push({
                              id: newUsers.length + 1,
                              email: worker.email,
                              password: worker.name.split(' ')[0].toLowerCase(),
                              name: worker.name,
                              role: 'employee',
                              businessId: currentUser.businessId,
                              workerId: workerId
                            });
                          });
                          
                          setWorkers(newWorkers);
                          setUsers(newUsers);
                          
                          alert('Demo setup complete!\n\nSample workers added with these credentials:\n' +
                            'alice@company.com / alice\n' +
                            'bob@company.com / bob\n' +
                            'carol@company.com / carol\n' +
                            'david@company.com / david\n' +
                            'eva@company.com / eva');
                        }, 100);
                      }}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                    >
                      Use Demo Setup (Restaurant)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Employee Dashboard */}
          {activeTab === 'dashboard' && currentUser.role === 'employee' && isSetupComplete() && currentWorker && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">My Dashboard</h2>
                <button
                  onClick={() => setShowAvailabilityForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span>Request Time Off</span>
                </button>
              </div>

              {/* Availability Status Alert */}
              {!hasAvailabilityForMonth(currentWorker?.id, currentMonth.getFullYear(), currentMonth.getMonth()) && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                    <div>
                      <p className="text-sm text-yellow-700">
                        <strong>Action Required:</strong> You need to submit your availability for {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
                      </p>
                      <button
                        onClick={() => initializeMonthlyAvailability(currentMonth)}
                        className="text-yellow-800 underline text-sm mt-1"
                      >
                        Submit Availability Now
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Stats - Rating removed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">My Upcoming Shifts</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {getMyShifts().filter(s => new Date(s.date) >= new Date()).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <Plus className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Open Shifts Available</p>
                      <p className="text-2xl font-bold text-gray-900">{getOpenShifts().length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upcoming Shifts */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Upcoming Shifts</h3>
                </div>
                <div className="p-6">
                  {getMyShifts().filter(s => new Date(s.date) >= new Date()).slice(0, 5).length === 0 ? (
                    <p className="text-gray-500">No upcoming shifts scheduled</p>
                  ) : (
                    <div className="space-y-3">
                      {getMyShifts().filter(s => new Date(s.date) >= new Date()).slice(0, 5).map((shift) => (
                        <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              {shift.name} - {shift.myRole}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(shift.date).toLocaleDateString()} • {shift.start} - {shift.end}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedShiftForSwap(shift);
                              setShowSwapRequest(true);
                            }}
                            className="text-blue-600 text-sm hover:text-blue-800"
                          >
                            Request Swap
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Schedule View (Both Employee and Admin/Manager) */}
          {activeTab === 'schedule' && isSetupComplete() && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Schedule</h2>
                <div className="flex items-center space-x-4">
                  {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
                    <button
                      onClick={() => setShowScheduleGenerator(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Generate Schedule</span>
                    </button>
                  )}
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    ←
                  </button>
                  <span className="font-medium">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="grid grid-cols-7 gap-px bg-gray-200">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="bg-gray-50 p-4 text-center font-medium text-gray-700">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-px bg-gray-200">
                  {getDatesInMonth().map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const daySchedule = schedule[dateStr];
                    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                    
                    return (
                      <div key={dateStr} className={`bg-white p-2 min-h-[140px] ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''}`}>
                        <div className={`font-medium mb-2 ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}`}>
                          {date.getDate()}
                        </div>
                        {daySchedule && isCurrentMonth && (
                          <div className="space-y-1">
                            {daySchedule.map(shift => (
                              <div
                                key={shift.id}
                                className={`text-xs bg-blue-50 border border-blue-200 p-2 rounded ${
                                  (currentUser.role === 'admin' || currentUser.role === 'manager') 
                                    ? 'cursor-pointer hover:bg-blue-100' 
                                    : ''
                                }`}
                                onClick={() => (currentUser.role === 'admin' || currentUser.role === 'manager') && openShiftEditor(shift, dateStr)}
                              >
                                <div className="font-bold text-blue-900 mb-1 flex items-center justify-between">
                                  <span>{shift.name}</span>
                                  {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
                                    <Edit className="h-3 w-3 text-blue-600" />
                                  )}
                                </div>
                                <div className="space-y-1">
                                  {shift.workers.map(worker => (
                                    <div key={`${shift.id}-${worker.workerId}`} className="flex items-center justify-between">
                                      <span className="text-blue-800 font-medium">{worker.workerName}</span>
                                      <span className="text-blue-600 text-xs bg-blue-100 px-1 rounded">
                                        {worker.roleName}
                                      </span>
                                    </div>
                                  ))}
                                  {shift.openPositions.map(openPos => (
                                    <div key={openPos.id} className="flex items-center justify-between">
                                      <span className="text-red-600 italic">Open Position</span>
                                      <span className="text-red-600 text-xs bg-red-100 px-1 rounded">
                                        {openPos.roleName}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* My Availability (Employee) */}
          {activeTab === 'availability' && currentUser.role === 'employee' && isSetupComplete() && currentWorker && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">My Availability</h2>
                <button
                  onClick={() => initializeMonthlyAvailability(currentMonth)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span>Update Availability</span>
                </button>
              </div>

              {/* Monthly Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[-1, 0, 1].map(offset => {
                  const month = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
                  const hasSubmitted = hasAvailabilityForMonth(currentWorker?.id, month.getFullYear(), month.getMonth());
                  
                  return (
                    <div key={offset} className={`p-4 rounded-lg border ${hasSubmitted ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </p>
                          <p className={`text-sm ${hasSubmitted ? 'text-green-600' : 'text-yellow-600'}`}>
                            {hasSubmitted ? 'Submitted' : 'Pending'}
                          </p>
                        </div>
                        {!hasSubmitted && (
                          <button
                            onClick={() => initializeMonthlyAvailability(month)}
                            className="text-blue-600 text-sm hover:text-blue-800"
                          >
                            Submit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">How to Submit Availability</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Click "Update Availability" to set your available days for any month</li>
                  <li>• Green days = Available, Red days = Unavailable</li>
                  <li>• You must submit availability before schedules can be generated</li>
                  <li>• Update your availability anytime, but changes after schedule generation may not be reflected</li>
                </ul>
              </div>
            </div>
          )}

          {/* Open Shifts (Employee) */}
          {activeTab === 'openShifts' && currentUser.role === 'employee' && isSetupComplete() && currentWorker && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Available Open Shifts</h2>

              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  {getOpenShifts().length === 0 ? (
                    <p className="text-gray-500">No open shifts available</p>
                  ) : (
                    <div className="space-y-4">
                      {getOpenShifts().map((shift) => (
                        <div key={`${shift.id}-${shift.openPosition.id}`} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-gray-900">
                                {new Date(shift.date).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                              <p className="text-lg font-medium text-gray-700">
                                {shift.name} - {shift.openPosition.roleName}
                              </p>
                              <p className="text-sm text-gray-500">
                                {shift.start} - {shift.end}
                              </p>
                            </div>
                            <button
                              onClick={() => pickupOpenShift(shift, shift.openPosition)}
                              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                            >
                              Pick Up Shift
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* My Requests (Employee) */}
          {activeTab === 'requests' && currentUser.role === 'employee' && isSetupComplete() && currentWorker && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">My Requests</h2>

              {/* Swap Requests */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Shift Swap Requests</h3>
                </div>
                <div className="p-6">
                  {pendingSwaps.filter(s => s.fromWorkerId === currentWorker?.id).length === 0 ? (
                    <p className="text-gray-500">No swap requests submitted</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingSwaps.filter(s => s.fromWorkerId === currentWorker?.id).map((swap) => (
                        <div key={swap.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              Swap with {swap.toWorkerName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {swap.shiftName} on {new Date(swap.shiftDate).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            swap.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            swap.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {swap.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Time-off Requests */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Time-off Requests</h3>
                </div>
                <div className="p-6">
                  {timeOffRequests.filter(r => r.workerId === currentWorker?.id).length === 0 ? (
                    <p className="text-gray-500">No time-off requests submitted</p>
                  ) : (
                    <div className="space-y-3">
                      {timeOffRequests.filter(r => r.workerId === currentWorker?.id).map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              {request.type === 'unavailable' ? 'Time Off' : 'Preferred Availability'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </p>
                            {request.reason && (
                              <p className="text-sm text-gray-400">{request.reason}</p>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {request.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Admin/Manager Dashboard */}
          {activeTab === 'dashboard' && (currentUser.role === 'admin' || currentUser.role === 'manager') && isSetupComplete() && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                <button
                  onClick={() => setShowScheduleGenerator(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Generate Schedule</span>
                </button>
              </div>

              {/* Availability Status Alert */}
              {(() => {
                const businessWorkers = workers.filter(w => w.businessId === currentUser.businessId);
                const workersWithoutAvailability = businessWorkers.filter(w => !hasAvailabilityForMonth(w.id, currentMonth.getFullYear(), currentMonth.getMonth()));
                
                if (workersWithoutAvailability.length > 0) {
                  return (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                        <div>
                          <p className="text-sm text-yellow-700">
                            <strong>Cannot Generate Schedule:</strong> {workersWithoutAvailability.length} worker(s) haven't submitted availability for {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
                          </p>
                          <p className="text-xs text-yellow-600 mt-1">
                            Missing: {workersWithoutAvailability.map(w => w.name).join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Workers</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {workers.filter(w => w.businessId === currentUser.businessId).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Shift Types Configured</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Math.max(...Object.values(currentBusiness?.dayConfigs || {}).map(config => config?.shifts?.length || 0))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {pendingSwaps.filter(s => s.status === 'pending').length + 
                         timeOffRequests.filter(r => r.status === 'pending').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center">
                    <CalendarDays className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Availability Submitted</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {workers.filter(w => w.businessId === currentUser.businessId && hasAvailabilityForMonth(w.id, currentMonth.getFullYear(), currentMonth.getMonth())).length}/{workers.filter(w => w.businessId === currentUser.businessId).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Notifications */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
                </div>
                <div className="p-6">
                  {notifications.length === 0 ? (
                    <p className="text-gray-500">No recent activity</p>
                  ) : (
                    <div className="space-y-3">
                      {notifications.slice(0, 5).map((notification) => (
                        <div key={notification.id} className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${
                            notification.type === 'success' ? 'bg-green-500' :
                            notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                          }`} />
                          <span className="text-sm text-gray-700">{notification.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
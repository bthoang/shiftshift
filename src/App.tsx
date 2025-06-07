import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Users, Settings, Bell, CheckCircle, User, RefreshCw, Plus, LogOut, CalendarDays, AlertTriangle, Loader2, Lock, UserPlus } from 'lucide-react';
import { supabase } from './supabaseClient';
import SetupWizard from './SetupWizard';
import WorkerManagement from './WorkerManagement';
import PasswordChange from './PasswordChange';
import AvailabilityManagement from './AvailabilityManagement';
import ScheduleGenerator from './ScheduleGenerator';
import EmployeeScheduleView from './EmployeeScheduleView';
import { Calendar } from './Calendar';
// Types
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  business_id: string;
  worker_id?: string;
}

interface Worker {
  id: string;
  name: string;
  email: string;
  rating: number;
  roles: number[];
  business_id: string;
  monthly_availability: Record<string, Record<string, any>>;
  invite_sent: boolean;
  user_created: boolean;
}

interface Business {
  id: string;
  name: string;
  roles: Role[];
  day_configs: Record<number, DayConfig>;
  setup_complete: boolean;
}

interface Role {
  id: number;
  name: string;
  color?: string;
}

interface DayConfig {
  shifts: ShiftConfig[];
}

interface ShiftConfig {
  name: string;
  start: string;
  end: string;
  role_requirements: Record<number, number>;
}

const EmployeeSchedulingSystem: React.FC = () => {
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);

  // Business state
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  // Load data when user logs in
  useEffect(() => {
    if (currentUser) {
      loadBusinessData();
    }
  }, [currentUser]);

  // Check if user is already logged in
  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (userData) {
          setCurrentUser(userData);
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load business data
  const loadBusinessData = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      // Load business
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', currentUser.business_id)
        .single();
      
      if (businessData) {
        setCurrentBusiness(businessData);
      }

      // Load workers
      const { data: workersData } = await supabase
        .from('workers')
        .select('*')
        .eq('business_id', currentUser.business_id);
      
      if (workersData) {
        setWorkers(workersData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load business data');
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const handleLogin = async () => {
    setAuthLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (userData) {
          setCurrentUser(userData);
          setIsLoggedIn(true);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async () => {
    setAuthLoading(true);
    setError(null);
    
    try {
      // First, check if there's a worker record with this email
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('email', signupForm.email)
        .single();
  
      if (workerError || !workerData) {
        throw new Error('No worker account found with this email. Please contact your administrator.');
      }
  
      // Sign up the user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
        options: {
          data: {
            name: signupForm.name,
            worker_id: workerData.id,
            business_id: workerData.business_id
          }
        }
      });
  
      if (authError) throw authError;
  
      if (authData.user) {
        // Create user record in the users table
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: signupForm.email,
            name: signupForm.name,
            role: 'employee',
            business_id: workerData.business_id,
            worker_id: workerData.id
          });
  
        if (userError) {
          console.error('Error creating user record:', userError);
        }
  
        // Update worker record to mark as having user account
        const { error: updateError } = await supabase
          .from('workers')
          .update({ user_created: true })
          .eq('id', workerData.id);
  
        if (updateError) {
          console.error('Error updating worker status:', updateError);
        }
  
        // Show success message
        alert(`Account created successfully! 
        
  Welcome ${signupForm.name}! 
        
  You can now log in with:
  Email: ${signupForm.email}
  Password: [the password you just created]
  
  Click "Back to Login" to sign in.`);
        
        // Clear form and go back to login
        setShowSignup(false);
        setSignupForm({ email: '', password: '', name: '' });
        
        // Pre-fill login form with their email
        setLoginForm({ ...loginForm, email: signupForm.email });
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      
      if (error.message?.includes('User already registered')) {
        setError('An account with this email already exists. Please log in instead.');
      } else if (error.message?.includes('No worker account found')) {
        setError(error.message);
      } else {
        setError(error.message || 'Signup failed. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsLoggedIn(false);
    setCurrentBusiness(null);
    setWorkers([]);
    setLoginForm({ email: '', password: '' });
    setSignupForm({ email: '', password: '', name: '' });
    setShowSignup(false);
  };

  // Add notification
  const addNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [...prev, notification]);
  };

  // Check if setup is complete
  const isSetupComplete = () => {
    if (!currentBusiness) return false;
    return currentBusiness.setup_complete;
  };

  // Handle setup completion
  const handleSetupComplete = async () => {
    await loadBusinessData();
    setActiveTab('dashboard');
    addNotification('Setup completed successfully!', 'success');
  };

  // Navigation items
  const getNavItems = () => {
    if (currentUser?.role === 'employee') {
      if (!isSetupComplete()) {
        return [];
      }
      return [
        { id: 'dashboard', label: 'My Dashboard', icon: CalendarIcon },
        { id: 'schedule', label: 'My Schedule', icon: Clock },
        { id: 'availability', label: 'My Availability', icon: CalendarDays },
      ];
    }

    const baseItems = [];

    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
      if (!isSetupComplete()) {
        baseItems.push({ id: 'setup', label: 'Initial Setup', icon: Settings, highlight: true });
      } else {
        baseItems.push(
          { id: 'dashboard', label: 'Dashboard', icon: CalendarIcon },
          { id: 'schedule', label: 'Schedule Generator', icon: Clock }
        );
      }
      
      baseItems.push(
        { id: 'workers', label: 'Workers', icon: Users },
        { id: 'settings', label: 'Settings', icon: Settings }
      );
    }

    return baseItems;
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Login/Signup Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-8">
            <CalendarIcon className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">ShiftSmart</h1>
            <p className="text-gray-600">Employee Scheduling System</p>
          </div>

          {!showSignup ? (
            /* Login Form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter your email"
                  disabled={authLoading}
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
                  disabled={authLoading}
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={authLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={() => {
                    setShowSignup(true);
                    setError(null);
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center justify-center space-x-1 mx-auto"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Create Worker Account</span>
                </button>
              </div>
            </div>
          ) : (
            /* Signup Form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={signupForm.name}
                  onChange={(e) => setSignupForm({...signupForm, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter your full name"
                  disabled={authLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
                <input
                  type="email"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({...signupForm, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Email provided by your employer"
                  disabled={authLoading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use the email address your administrator provided
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Choose Password</label>
                <input
                  type="password"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm({...signupForm, password: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Create a secure password"
                  disabled={authLoading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 6 characters
                </p>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}

              <button
                onClick={handleSignup}
                disabled={authLoading || !signupForm.name || !signupForm.email || signupForm.password.length < 6}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={() => {
                    setShowSignup(false);
                    setError(null);
                  }}
                  className="text-gray-600 hover:text-gray-700 text-sm"
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 text-sm text-gray-600">
            <p className="font-medium mb-2">Note:</p>
            <p className="text-xs text-gray-500">
              {showSignup 
                ? "Only create an account if your administrator has added you as a worker"
                : "Contact your administrator for login credentials or to create a worker account"
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main app content
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <CalendarIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">ShiftSmart</h1>
                <p className="text-sm text-gray-500">{currentBusiness?.name || 'Loading...'}</p>
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
                <span className="text-sm font-medium text-gray-700">{currentUser?.name}</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {currentUser?.role}
                </span>
              </div>
              {currentUser?.role === 'employee' && (
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="text-gray-600 hover:text-gray-800 flex items-center space-x-1 text-sm"
                >
                  <Lock className="h-4 w-4" />
                  <span>Change Password</span>
                </button>
              )}
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
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
              
              {!isSetupComplete() && (currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                    <div>
                      <p className="text-sm text-yellow-700">
                        <strong>Setup Required:</strong> Please complete the initial setup to start using ShiftSmart.
                      </p>
                      <button
                        onClick={() => setActiveTab('setup')}
                        className="text-yellow-800 underline text-sm mt-1"
                      >
                        Go to Setup
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-2">Total Workers</h3>
                  <p className="text-3xl font-bold text-blue-600">{workers.length}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-2">Active Workers</h3>
                  <p className="text-3xl font-bold text-green-600">
                    {workers.filter(w => w.user_created).length}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-2">Pending Setup</h3>
                  <p className="text-3xl font-bold text-orange-600">
                    {workers.filter(w => !w.user_created).length}
                  </p>
                </div>
              </div>

              {currentUser?.role === 'employee' && !isSetupComplete() && (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">System Not Ready</h3>
                  <p className="text-gray-600">
                    The scheduling system is being set up by your administrator. 
                    Please check back later or contact your manager for more information.
                  </p>
                </div>
              )}

              {currentUser?.role === 'employee' && isSetupComplete() && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setActiveTab('availability')}
                      className="p-4 border rounded-lg hover:bg-gray-50 text-left"
                    >
                      <CalendarDays className="h-8 w-8 text-blue-600 mb-2" />
                      <h4 className="font-medium">Set Availability</h4>
                      <p className="text-sm text-gray-600">Update your availability for upcoming shifts</p>
                    </button>
                    <button
                      onClick={() => setActiveTab('schedule')}
                      className="p-4 border rounded-lg hover:bg-gray-50 text-left"
                    >
                      <Clock className="h-8 w-8 text-green-600 mb-2" />
                      <h4 className="font-medium">View Schedule</h4>
                      <p className="text-sm text-gray-600">Check your assigned shifts</p>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Setup */}
          {activeTab === 'setup' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager') && (
            <SetupWizard 
              businessId={currentUser.business_id} 
              onComplete={handleSetupComplete}
            />
          )}

          {/* Workers */}
          {activeTab === 'workers' && currentUser && (
            <WorkerManagement 
              businessId={currentUser.business_id}
              workers={workers}
              roles={currentBusiness?.roles || []}
              onWorkersUpdate={loadBusinessData}
            />
          )}
          
          {/* Schedule */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              {currentUser?.role === 'employee' ? (
                // Employee Schedule View
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">My Schedule</h2>
                  <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-gray-500 text-center py-8">
                      {isSetupComplete() 
                        ? "Your schedule will appear here once your administrator generates it."
                        : "Please wait for your administrator to complete the system setup."}
                    </p>
                  </div>
                </div>
              ) : (
                // Admin Schedule Generator
                currentUser && currentBusiness && (
                  <ScheduleGenerator
                    businessId={currentUser.business_id}
                    currentBusiness={currentBusiness}
                    workers={workers}
                  />
                )
              )}
            </div>
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium mb-4">Business Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      value={currentBusiness?.name || ''}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      disabled
                    />
                  </div>
                  {isSetupComplete() && currentBusiness?.roles && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Configured Roles</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentBusiness.roles.map((role) => (
                          <span key={role.id} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                            {role.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4">
                    <button
                      onClick={() => setActiveTab('setup')}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      {isSetupComplete() ? 'Modify Setup Configuration' : 'Run Initial Setup'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium mb-4">Account Settings</h3>
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="flex items-center space-x-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  <Lock className="h-4 w-4" />
                  <span>Change Password</span>
                </button>
              </div>
            </div>
          )}

          {/* Availability (Employee) */}
          {activeTab === 'availability' && currentUser?.role === 'employee' && currentUser.worker_id && currentBusiness && (
            <AvailabilityManagement
              workerId={currentUser.worker_id}
              currentUser={currentUser}
              currentBusiness={currentBusiness}
            />
          )}
        </main>
      </div>

      {/* Password Change Modal */}
      {showPasswordChange && (
        <PasswordChange onClose={() => setShowPasswordChange(false)} />
      )}
    </div>
  );
};

export default EmployeeSchedulingSystem;

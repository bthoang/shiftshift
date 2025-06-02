import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Settings, Bell, CheckCircle, User, RefreshCw, Plus, LogOut, CalendarDays, AlertTriangle, Loader2, Lock } from 'lucide-react';
import { supabase } from './supabaseClient';
import SetupWizard from './SetupWizard';
import WorkerManagement from './WorkerManagement';
import PasswordChange from './PasswordChange';

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
  monthly_availability: Record<string, Record<string, boolean>>;
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
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsLoggedIn(false);
    setCurrentBusiness(null);
    setWorkers([]);
    setLoginForm({ email: '', password: '' });
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
        { id: 'dashboard', label: 'My Dashboard', icon: Calendar },
        { id: 'schedule', label: 'Schedule', icon: Clock },
        { id: 'availability', label: 'My Availability', icon: CalendarDays },
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
          </div>

          <div className="mt-6 text-sm text-gray-600">
            <p className="font-medium mb-2">Note:</p>
            <p className="text-xs text-gray-500">
              Contact your administrator for login credentials
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
              <Calendar className="h-8 w-8 text-blue-600" />
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
                  <h3 className="text-lg font-medium mb-2">Active Shifts</h3>
                  <p className="text-3xl font-bold text-green-600">0</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-2">Pending Requests</h3>
                  <p className="text-3xl font-bold text-orange-600">0</p>
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
            </div>
          )}

          {/* Setup */}
          {activeTab === 'setup' && (currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <SetupWizard 
              businessId={currentUser.business_id} 
              onComplete={handleSetupComplete}
            />
          )}

          {/* Workers */}
          {activeTab === 'workers' && (
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
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Schedule</h2>
                {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4" />
                    <span>Generate Schedule</span>
                  </button>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500 text-center py-8">
                  {isSetupComplete() 
                    ? "No schedule generated yet. Click 'Generate Schedule' to create one."
                    : "Please complete the initial setup before generating schedules."}
                </p>
              </div>
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
            </div>
          )}

          {/* Availability (Employee) */}
          {activeTab === 'availability' && currentUser?.role === 'employee' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">My Availability</h2>
              
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500 text-center py-8">
                  Availability management will be available once the system is fully configured.
                </p>
              </div>
            </div>
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

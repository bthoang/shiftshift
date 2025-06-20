import React, { useState } from 'react';
import { Plus, Edit, Trash2, Star, Mail, Loader2, AlertTriangle, X, Send, UserPlus } from 'lucide-react';
import { supabase } from './supabaseClient';

interface Worker {
  id: string;
  name: string;
  email: string;
  rating: number;
  roles: number[];
  business_id: string;
  invite_sent: boolean;
  user_created: boolean;
}

interface WorkerManagementProps {
  businessId: string;
  workers: Worker[];
  roles: any[];
  onWorkersUpdate: () => void;
}

// Confirmation Modal Component
interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger'
}) => {
  if (!isOpen) return null;

  const getButtonColor = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center mb-4">
          <AlertTriangle className={`h-6 w-6 ${getIconColor()} mr-3`} />
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="flex space-x-3">
          <button
            onClick={onConfirm}
            className={`flex-1 ${getButtonColor()} text-white py-2 rounded-lg transition-colors`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

const WorkerManagement: React.FC<WorkerManagementProps> = ({ 
  businessId, 
  workers, 
  roles,
  onWorkersUpdate 
}) => {
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [saving, setSaving] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [currentInstructions, setCurrentInstructions] = useState({ name: '', email: '' });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    rating: 5,
    selectedRoles: [] as number[]
  });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const workerData = {
        name: formData.name,
        email: formData.email,
        rating: formData.rating,
        roles: formData.selectedRoles,
        business_id: businessId,
        invite_sent: false,
        user_created: false
      };

      if (editingWorker) {
        // Update existing worker (don't update email)
        const { error } = await supabase
          .from('workers')
          .update({
            name: formData.name,
            rating: formData.rating,
            roles: formData.selectedRoles
          })
          .eq('id', editingWorker.id);
        
        if (error) throw error;
        onWorkersUpdate();
        setShowAddWorker(false);
        setEditingWorker(null);
        setFormData({ name: '', email: '', rating: 5, selectedRoles: [] });
      } else {
        // Create new worker record
        const { data: worker, error: workerError } = await supabase
          .from('workers')
          .insert(workerData)
          .select()
          .single();
        
        if (workerError) throw workerError;

        // Show instructions modal
        setCurrentInstructions({ name: formData.name, email: formData.email });
        setShowInstructions(true);
        
        onWorkersUpdate();
        setShowAddWorker(false);
        setFormData({ name: '', email: '', rating: 5, selectedRoles: [] });
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Failed to save worker');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!workerToDelete) return;
    
    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', workerToDelete);
      
      if (error) throw error;
      onWorkersUpdate();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to delete worker');
    } finally {
      setWorkerToDelete(null);
    }
  };

  const sendSignupInvite = async (workerId: string, email: string, name: string) => {
    try {
      // Mark as invite sent
      await supabase
        .from('workers')
        .update({ invite_sent: true })
        .eq('id', workerId);
      
      // Show instructions modal
      setCurrentInstructions({ name, email });
      setShowInstructions(true);
      
      onWorkersUpdate();
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Failed to update invite status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Workers</h2>
        <button
          onClick={() => {
            setFormData({ name: '', email: '', rating: 5, selectedRoles: [] });
            setEditingWorker(null);
            setShowAddWorker(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Worker</span>
        </button>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex items-center">
          <UserPlus className="h-5 w-5 text-blue-400 mr-2" />
          <div>
            <p className="text-sm text-blue-700">
              <strong>How it works:</strong> Add workers here, then share signup instructions with them. 
              Workers create their own accounts using the email you specify.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        {workers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No workers added yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {workers.map(worker => (
              <div key={worker.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="font-medium text-gray-900">{worker.name}</p>
                    <p className="text-sm text-gray-500 flex items-center">
                      <Mail className="h-3 w-3 mr-1" />
                      {worker.email}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      {worker.user_created ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          ✓ Account Active
                        </span>
                      ) : worker.invite_sent ? (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                          Instructions Sent
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                          Pending Setup
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm">{worker.rating}/10</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {worker.roles.map(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      return role ? (
                        <span key={roleId} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          {role.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!worker.user_created && (
                    <button
                      onClick={() => sendSignupInvite(worker.id, worker.email, worker.name)}
                      className="text-green-600 hover:text-green-800 flex items-center space-x-1 text-sm"
                      title="Show signup instructions"
                    >
                      <Send className="h-4 w-4" />
                      <span>Send Instructions</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setFormData({
                        name: worker.name,
                        email: worker.email,
                        rating: worker.rating,
                        selectedRoles: worker.roles
                      });
                      setEditingWorker(worker);
                      setShowAddWorker(true);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setWorkerToDelete(worker.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddWorker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {editingWorker ? 'Edit Worker' : 'Add New Worker'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="john@example.com"
                  disabled={!!editingWorker}
                />
                {!editingWorker && (
                  <p className="text-xs text-gray-500 mt-1">
                    Worker will need to sign up with this email address
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Rating (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Roles</label>
                <div className="space-y-2">
                  {roles.map(role => (
                    <label key={role.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.selectedRoles.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              selectedRoles: [...formData.selectedRoles, role.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              selectedRoles: formData.selectedRoles.filter(id => id !== role.id)
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{role.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSubmit}
                disabled={
                  saving || 
                  !formData.name || 
                  !formData.email || 
                  formData.selectedRoles.length === 0
                }
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center justify-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddWorker(false);
                  setEditingWorker(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <UserPlus className="h-6 w-6 text-blue-600 mr-3" />
              <h3 className="text-lg font-bold">Worker Setup Instructions</h3>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="font-medium text-blue-900 mb-2">
                Share these instructions with {currentInstructions.name}:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Go to the ShiftShift login page</li>
                <li>Click "Create Worker Account"</li>
                <li>Sign up using email: <strong>{currentInstructions.email}</strong></li>
                <li>Create a secure password</li>
                <li>Complete the signup process</li>
                <li>Log in to set availability</li>
              </ol>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Once {currentInstructions.name} completes signup, their status will update to "Account Active" automatically.
            </p>

            <button
              onClick={() => setShowInstructions(false)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={workerToDelete !== null}
        title="Delete Worker"
        message="Are you sure you want to delete this worker? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setWorkerToDelete(null)}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default WorkerManagement;

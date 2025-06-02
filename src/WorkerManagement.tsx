import React, { useState } from 'react';
import { Plus, Edit, Trash2, Star, Mail, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';

interface Worker {
  id: string;
  name: string;
  email: string;
  rating: number;
  roles: number[];
  business_id: string;
}

interface WorkerManagementProps {
  businessId: string;
  workers: Worker[];
  roles: any[];
  onWorkersUpdate: () => void;
}

const WorkerManagement: React.FC<WorkerManagementProps> = ({ 
  businessId, 
  workers, 
  roles,
  onWorkersUpdate 
}) => {
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [saving, setSaving] = useState(false);
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
        business_id: businessId
      };

      if (editingWorker) {
        // Update existing worker
        const { error } = await supabase
          .from('workers')
          .update(workerData)
          .eq('id', editingWorker.id);
        
        if (error) throw error;
      } else {
        // Create new worker
        const { data: worker, error: workerError } = await supabase
          .from('workers')
          .insert(workerData)
          .select()
          .single();
        
        if (workerError) throw workerError;

        // Create auth user
        const password = formData.name.split(' ')[0].toLowerCase() + '123';
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            name: formData.name,
            role: 'employee',
            business_id: businessId
          }
        });

        if (authError) throw authError;

        // Update user record with worker_id
        if (authData.user) {
          await supabase
            .from('users')
            .update({ worker_id: worker.id })
            .eq('id', authData.user.id);
        }

        alert(`Worker created!\nEmail: ${formData.email}\nPassword: ${password}`);
      }

      onWorkersUpdate();
      setShowAddWorker(false);
      setEditingWorker(null);
      setFormData({ name: '', email: '', rating: 5, selectedRoles: [] });
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save worker');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (workerId: string) => {
    if (!confirm('Are you sure you want to delete this worker?')) return;
    
    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', workerId);
      
      if (error) throw error;
      onWorkersUpdate();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to delete worker');
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
                    onClick={() => handleDelete(worker.id)}
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
                disabled={saving || !formData.name || !formData.email || formData.selectedRoles.length === 0}
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
    </div>
  );
};

export default WorkerManagement;

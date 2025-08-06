'use client';

import React, { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    company: '',
    role: '',
    phone: '',
  });

  React.useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.user_metadata?.full_name || '',
        company: user.user_metadata?.company || '',
        role: user.user_metadata?.role || '',
        phone: user.user_metadata?.phone || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    try {
      // In a real implementation, you'd update the user's profile here
      // For now, we'll just simulate the save
      console.log('Saving profile data:', formData);
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    if (user) {
      setFormData({
        fullName: user.user_metadata?.full_name || '',
        company: user.user_metadata?.company || '',
        role: user.user_metadata?.role || '',
        phone: user.user_metadata?.phone || '',
      });
    }
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Profile</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Sign in required
              </h3>
              <p className="mt-2 text-sm text-yellow-700">
                You must be signed in to view and edit your profile.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-gray-600">Manage your account information and preferences</p>
      </div>

      <div className="bg-white shadow-lg rounded-lg">
        {/* Profile Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              {user.user_metadata?.avatar_url ? (
                <img
                  className="h-16 w-16 rounded-full object-cover"
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">
                    {(formData.fullName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {formData.fullName || 'User'}
              </h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <p className="text-xs text-gray-400">
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex-shrink-0">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="space-x-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="px-6 py-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                Email address cannot be changed. Contact support if you need to update this.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  !isEditing ? 'bg-gray-50 text-gray-500' : ''
                }`}
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  !isEditing ? 'bg-gray-50 text-gray-500' : ''
                }`}
                placeholder="Enter your company name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role/Title
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  !isEditing ? 'bg-gray-50 text-gray-500' : ''
                }`}
                placeholder="Enter your role or job title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  !isEditing ? 'bg-gray-50 text-gray-500' : ''
                }`}
                placeholder="Enter your phone number"
              />
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Account Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Account ID:</span>
              <span className="ml-2 font-mono text-xs text-gray-700">{user.id}</span>
            </div>
            <div>
              <span className="text-gray-500">Email Verified:</span>
              <span className={`ml-2 ${user.email_confirmed_at ? 'text-green-600' : 'text-red-600'}`}>
                {user.email_confirmed_at ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Last Sign In:</span>
              <span className="ml-2 text-gray-700">
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Provider:</span>
              <span className="ml-2 text-gray-700 capitalize">
                {user.app_metadata?.provider || 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
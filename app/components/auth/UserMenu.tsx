'use client';

/** @jsxRuntime classic */
/** @jsx React.createElement */

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  UserIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    setIsOpen(false);
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        alert('Failed to sign out. Please try again.');
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error);
    }
  };

  if (!user) return null;

  const displayName = user.user_metadata?.full_name || user.email || 'User';
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="relative" ref={menuRef}>
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <div className="flex items-center space-x-2">
          {avatarUrl ? (
            <img
              className="w-8 h-8 rounded-full"
              src={avatarUrl}
              alt={displayName}
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="hidden md:block text-gray-700 font-medium">
            {displayName.split(' ')[0]}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-h-screen overflow-y-auto"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-button"
        >
          <div className="py-2">
            {/* User Info */}
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
            </div>
            
            {/* Menu Items */}
            <div className="py-1">
              <MenuItem href="/profile" icon={UserIcon}>
                Profile
              </MenuItem>
              <MenuItem href="/usage-billing" icon={CreditCardIcon}>
                Usage & Billing
              </MenuItem>
              <MenuItem href="/settings" icon={Cog6ToothIcon}>
                Settings
              </MenuItem>
            </div>

            {/* Sign Out */}
            <div className="py-1 border-t border-gray-100">
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
                role="menuitem"
              >
                <ArrowRightStartOnRectangleIcon className="w-5 h-5 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom MenuItem component for reuse
function MenuItem({ href, children, icon: Icon }: { href: string, children: React.ReactNode, icon: React.ElementType }) {
  return (
    <Link
      href={href}
      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      role="menuitem"
    >
      <Icon className="w-5 h-5 mr-3 text-gray-400" />
      {children}
    </Link>
  );
}

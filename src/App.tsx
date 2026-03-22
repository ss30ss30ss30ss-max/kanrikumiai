/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import ApprovalPending from './components/ApprovalPending';
import Dashboard from './components/Dashboard';
import Members from './components/Members';
import Accounting from './components/Accounting';
import Announcements from './components/Announcements';
import Calendar from './components/Calendar';
import AdminPage from './components/AdminPage';
import AccountApproval from './components/AccountApproval';
import DocumentCreator from './components/DocumentCreator';
import ConfirmModal from './components/ConfirmModal';

const AppContent: React.FC = () => {
  const { user, profile, loading, alert, hideAlert } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const isMasterAdmin = profile?.email === 'admin@smart-management.local';
  if (profile && !profile.isApproved && profile.role !== 'manager' && !isMasterAdmin) {
    return <ApprovalPending />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={setActiveTab} />;
      case 'members': return <Members />;
      case 'accounting': return <Accounting />;
      case 'announcements': return <Announcements />;
      case 'calendar': return <Calendar />;
      case 'documents': return <DocumentCreator />;
      case 'approval': return <AccountApproval />;
      case 'admin': return <AdminPage />;
      default: return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
      <ConfirmModal
        isOpen={alert?.isOpen || false}
        onClose={hideAlert}
        onConfirm={hideAlert}
        title={alert?.title || '通知'}
        message={alert?.message || ''}
        confirmText="OK"
        showCancel={false}
        variant="info"
      />
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

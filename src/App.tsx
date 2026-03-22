/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import BulletinBoard from './components/BulletinBoard';
import Inquiries from './components/Inquiries';
import ConfirmModal from './components/ConfirmModal';

// Simple Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("App Crash:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-4xl font-black mb-4 text-rose-500">エラーが発生しました</h1>
          <p className="text-slate-400 mb-8 max-w-md">アプリケーションの実行中に予期しないエラーが発生しました。ページを再読み込みしてください。</p>
          <pre className="bg-slate-900 p-4 rounded-xl text-xs text-rose-300 overflow-auto max-w-full text-left">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-8 px-8 py-3 bg-indigo-600 rounded-xl font-bold"
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { user, profile, loading, alert, hideAlert, isAuthReady } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    console.log("App State:", { user: user?.uid, profile: profile?.name, loading, isAuthReady });
  }, [user, profile, loading, isAuthReady]);

  if (loading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Loading System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  if (profile && !profile.isApproved && profile.role !== 'manager' && !isMasterAdmin) {
    return <ApprovalPending />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={setActiveTab} />;
      case 'members': return <Members />;
      case 'accounting': return <Accounting />;
      case 'announcements': return <Announcements />;
      case 'bulletin': return <BulletinBoard />;
      case 'inquiries': return <Inquiries />;
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
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

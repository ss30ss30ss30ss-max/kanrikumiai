import React, { useState } from 'react';
import { useAuth, logAction } from '../AuthContext';
import { LogOut, LayoutDashboard, Users, CreditCard, Bell, Calendar, Settings, Menu, X, ShieldCheck, Wallet, Building2, UserCheck } from 'lucide-react';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const PCNavBtn = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 translate-x-1' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}>
    {icon}
    <span className="text-sm font-black tracking-tight">{label}</span>
  </button>
);

const MobileNavBtn = ({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={`p-3 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}>{icon}</button>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile, user } = useAuth();

  const handleLogout = async () => {
    if (user) {
      await logAction('ログアウト', `${profile?.roomNumber || '管理者'}がログアウトしました`, user.uid);
    }
    auth.signOut();
  };

  const isMasterAdmin = profile?.email === 'admin@smart-management.local';
  const isManager = profile?.role === 'manager' || isMasterAdmin;

  const roleLabel = isMasterAdmin ? 'システム管理者' :
                    profile?.role === 'manager' ? '管理人' : 
                    profile?.role === 'accountant' ? '会計' : 
                    profile?.role === 'asst_accountant' ? '会計補佐' :
                    profile?.role === 'asst_manager' ? '管理補佐' : '一般居住者';

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex font-sans">
      {/* Sidebar PC */}
      <aside className="hidden lg:flex flex-col w-72 bg-slate-950 border-r border-slate-800/60 p-6 sticky top-0 h-screen overflow-y-auto shrink-0">
        <div className="flex items-center gap-3 text-white mb-10 pl-2">
          <ShieldCheck className="text-indigo-500" size={28} />
          <span className="font-black text-xl tracking-tight">スマート管理</span>
        </div>
        <nav className="flex-1 space-y-1">
          <PCNavBtn icon={<LayoutDashboard size={20}/>} label="ホーム" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">メインメニュー</div>
          <PCNavBtn icon={<Users size={20}/>} label="名簿確認" active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
          <PCNavBtn icon={<Wallet size={20}/>} label="会計・決算" active={activeTab === 'accounting'} onClick={() => setActiveTab('accounting')} />
          <PCNavBtn icon={<Bell size={20}/>} label="お知らせ" active={activeTab === 'announcements'} onClick={() => setActiveTab('announcements')} />
          <PCNavBtn icon={<Calendar size={20}/>} label="カレンダー" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          
          {isManager && (
            <>
              <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">管理業務</div>
              <PCNavBtn icon={<UserCheck size={20}/>} label="アカウント承認" active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} />
            </>
          )}

          {isMasterAdmin && (
            <PCNavBtn icon={<Settings size={20}/>} label="システム設定" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />
          )}
        </nav>
        
        <div className="mt-8 p-5 bg-slate-900/50 rounded-3xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-950 rounded-xl flex items-center justify-center font-bold text-indigo-400">
              {profile?.roomNumber?.[0] || profile?.name?.[0] || '?'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white truncate text-sm">{profile?.name || 'ユーザー'}</p>
              <p className="text-[10px] text-indigo-400 font-bold uppercase">{roleLabel}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 text-slate-500 font-bold text-xs hover:text-red-400 transition-colors">
            <LogOut size={14}/> ログアウト
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-slate-950/40 backdrop-blur-xl border-b border-slate-800/60 h-16 md:h-20 flex items-center justify-between px-6 md:px-10 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h3 className="font-black text-white text-lg md:text-xl">
              {activeTab === 'dashboard' ? 'ホーム' : 
               activeTab === 'members' ? '名簿確認' : 
               activeTab === 'accounting' ? '会計・決算' : 
               activeTab === 'announcements' ? 'お知らせ' :
               activeTab === 'calendar' ? 'カレンダー' :
               activeTab === 'approval' ? 'アカウント承認' :
               activeTab === 'admin' ? 'システム設定' : activeTab}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center relative">
              <Bell size={18} className="text-slate-400" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-slate-900" />
            </div>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors group"
              title="ログアウト"
            >
              <LogOut size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 pb-24 lg:pb-12">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 h-16 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 flex items-center justify-around rounded-3xl z-50 shadow-2xl">
        <MobileNavBtn icon={<LayoutDashboard size={20}/>} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavBtn icon={<Users size={20}/>} active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
        <MobileNavBtn icon={<Wallet size={20}/>} active={activeTab === 'accounting'} onClick={() => setActiveTab('accounting')} />
        {isManager && <MobileNavBtn icon={<UserCheck size={20}/>} active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} />}
        {isMasterAdmin && <MobileNavBtn icon={<Settings size={20}/>} active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />}
        <MobileNavBtn icon={<LogOut size={20}/>} active={false} onClick={handleLogout} />
      </nav>
    </div>
  );
};

export default Layout;

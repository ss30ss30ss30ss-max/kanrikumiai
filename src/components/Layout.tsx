import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { Announcement, ParkingSettings } from '../types';
import { LogOut, LayoutDashboard, Users, CreditCard, Bell, Calendar, Settings, Menu, X, ShieldCheck, Wallet, Building2, UserCheck, FileText, MessageSquare, Car, User } from 'lucide-react';
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
  <button onClick={onClick} className={`p-3 rounded-2xl transition-all shrink-0 ${active ? 'bg-indigo-600 text-white scale-110 shadow-lg' : 'text-slate-500'}`}>{icon}</button>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile, user, handleFirestoreError } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadInquiries, setUnreadInquiries] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [parkingSettings, setParkingSettings] = useState<ParkingSettings>({ isPublic: false });

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isPrivileged = profile && (['manager', 'admin', 'accountant', 'asst_manager', 'asst_accountant'].includes(profile.role) || isMasterAdmin);
  const isManager = profile?.role === 'manager' || profile?.role === 'admin' || isMasterAdmin;
  const isAdmin = profile?.role === 'admin' || isMasterAdmin;

  useEffect(() => {
    if (!profile || !auth.currentUser) return;

    const q = query(collection(db, 'announcements'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      const unread = announcements.filter(ann => !ann.readBy?.includes(auth.currentUser?.uid || ''));
      setUnreadCount(unread.length);
    }, (error) => {
      // Only log error if the user is actually supposed to have access
      if (profile?.isApproved) {
        handleFirestoreError(error, 'list' as any, 'announcements');
      }
    });

    // Inquiry unread count
    let unsubscribeInq: (() => void) | null = null;
    if (auth.currentUser && profile) {
      let qInq;
      if (isManager) {
        qInq = query(collection(db, 'inquiries'));
      } else {
        qInq = query(collection(db, 'inquiries'), where('userId', '==', auth.currentUser.uid));
      }
      
      unsubscribeInq = onSnapshot(qInq, (snapshot) => {
        const inqs = snapshot.docs.map(doc => doc.data());
        const unread = inqs.filter(inq => isManager ? inq.unreadByManager : inq.unreadByResident);
        setUnreadInquiries(unread.length);
      }, (error) => {
        // Silent error for unread count to prevent annoying alerts if rules are tight
        console.warn('Unread inquiries count error:', error.message);
      });
    }

    // Pending approval count - only for managers who have permission
    let unsubscribeApproval: (() => void) | null = null;
    if (isManager) {
      const qApproval = query(collection(db, 'users'), where('isApproved', '==', false));
      unsubscribeApproval = onSnapshot(qApproval, (snapshot) => {
        setPendingApprovalCount(snapshot.docs.length);
      }, (error) => {
        console.warn('Pending approval count error:', error.message);
      });
    }

    // Parking settings
    const unsubParking = onSnapshot(doc(db, 'settings', 'parking'), (docSnap) => {
      if (docSnap.exists()) {
        setParkingSettings(docSnap.data() as ParkingSettings);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeInq) unsubscribeInq();
      if (unsubscribeApproval) unsubscribeApproval();
      unsubParking();
    };
  }, [profile, isManager, isPrivileged]);

  const handleLogout = async () => {
    if (user) {
      await logAction('ログアウト', `${profile?.roomNumber || '管理者'}がログアウトしました`, user.uid);
    }
    auth.signOut();
  };

  const roleLabel = isMasterAdmin ? 'マスター管理者' :
                    profile?.role === 'admin' ? 'システム管理者' :
                    profile?.role === 'manager' ? '管理人' : 
                    profile?.role === 'accountant' ? '会計' : 
                    profile?.role === 'asst_accountant' ? '会計補佐' :
                    profile?.role === 'asst_manager' ? '管理補佐' : '一般居住者';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex font-sans">
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
          <PCNavBtn icon={<Bell size={20}/>} label="お知らせ" active={activeTab === 'announcements'} onClick={() => setActiveTab('announcements')} />
          <PCNavBtn 
            icon={<div className="relative"><MessageSquare size={20}/>{unreadInquiries > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}</div>} 
            label="問い合わせ" 
            active={activeTab === 'inquiries'} 
            onClick={() => setActiveTab('inquiries')} 
          />
          <PCNavBtn icon={<Calendar size={20}/>} label="カレンダー" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          <PCNavBtn icon={<Car size={20}/>} label="駐車場予約" active={activeTab === 'parking'} onClick={() => setActiveTab('parking')} />
          
          {isPrivileged && (
            <>
              <PCNavBtn icon={<FileText size={20}/>} label="配布用文書" active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} />
            </>
          )}

          {isManager && (
            <>
              <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">管理業務</div>
              <PCNavBtn 
                icon={
                  <div className="relative">
                    <UserCheck size={20}/>
                    {pendingApprovalCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border border-slate-950 animate-bounce">
                        {pendingApprovalCount}
                      </span>
                    )}
                  </div>
                } 
                label="アカウント承認" 
                active={activeTab === 'approval'} 
                onClick={() => setActiveTab('approval')} 
              />
            </>
          )}

          {isManager && (
            <PCNavBtn icon={<Settings size={20}/>} label="システム管理" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />
          )}
        </nav>
        
        <div className="mt-8 p-5 bg-slate-900/50 rounded-3xl border border-slate-800">
          <button 
            onClick={() => setActiveTab('mypage')}
            className="w-full flex items-center gap-3 mb-4 p-2 rounded-2xl hover:bg-slate-800 transition-all text-left group"
          >
            <div className="w-10 h-10 bg-indigo-950 rounded-xl flex items-center justify-center font-bold text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              {profile?.roomNumber?.[0] || profile?.name?.[0] || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white truncate text-sm group-hover:text-indigo-400 transition-all">{profile?.name || 'ユーザー'}</p>
              <p className="text-[10px] text-indigo-400 font-bold uppercase">{roleLabel}</p>
            </div>
            <Settings size={14} className="text-slate-600 group-hover:text-indigo-400" />
          </button>
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
               activeTab === 'bulletin' ? '掲示板' :
               activeTab === 'inquiries' ? '問い合わせ' :
               activeTab === 'parking' ? '駐車場予約' :
               activeTab === 'mypage' ? 'マイページ' :
               activeTab === 'calendar' ? 'カレンダー' :
               activeTab === 'documents' ? '配布用文書' :
               activeTab === 'approval' ? 'アカウント承認' :
               activeTab === 'admin' ? 'システム設定' : activeTab}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('announcements')}
              className="w-10 h-10 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center relative hover:bg-slate-800 transition-colors"
              title="お知らせを確認"
            >
              <Bell size={18} className="text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-slate-950 animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors group"
              title="ログアウト"
            >
              <LogOut size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </header>

        <main className={`flex-1 ${activeTab === 'inquiries' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'} p-4 md:p-8 lg:p-10 pb-32 lg:pb-12`}>
          <div className={`max-w-6xl mx-auto w-full ${activeTab === 'inquiries' ? 'h-full flex flex-col' : ''}`}>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 h-16 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 flex items-center gap-2 overflow-x-auto rounded-3xl z-50 shadow-2xl px-4 scrollbar-hide">
        <MobileNavBtn icon={<LayoutDashboard size={20}/>} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavBtn icon={<Users size={20}/>} active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
        <MobileNavBtn 
          icon={<div className="relative"><MessageSquare size={20}/>{unreadInquiries > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}</div>} 
          active={activeTab === 'inquiries'} 
          onClick={() => setActiveTab('inquiries')} 
        />
        <MobileNavBtn icon={<Bell size={20}/>} active={activeTab === 'announcements'} onClick={() => setActiveTab('announcements')} />
        <MobileNavBtn icon={<Car size={20}/>} active={activeTab === 'parking'} onClick={() => setActiveTab('parking')} />
        <MobileNavBtn icon={<User size={20}/>} active={activeTab === 'mypage'} onClick={() => setActiveTab('mypage')} />
        
        {isPrivileged && (
          <>
            <MobileNavBtn icon={<Wallet size={20}/>} active={activeTab === 'accounting'} onClick={() => setActiveTab('accounting')} />
            <MobileNavBtn icon={<FileText size={20}/>} active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} />
          </>
        )}
        
        {isManager && (
          <MobileNavBtn 
            icon={
              <div className="relative">
                <UserCheck size={20}/>
                {pendingApprovalCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                )}
              </div>
            } 
            active={activeTab === 'approval'} 
            onClick={() => setActiveTab('approval')} 
          />
        )}
        
        {isManager && <MobileNavBtn icon={<Settings size={20}/>} active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />}
      </nav>
    </div>
  );
};

export default Layout;

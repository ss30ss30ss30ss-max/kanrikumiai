import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Announcement, CalendarEvent, AccountingRecord } from '../types';
import { Bell, Calendar as CalendarIcon, CreditCard, Users, LayoutDashboard, Building2, Settings, FileText, Sparkles, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';

const QuickAction = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <div onClick={onClick} className="bg-slate-900/60 border border-slate-800 p-5 rounded-[2rem] flex flex-col items-center gap-3 cursor-pointer hover:bg-slate-800 transition-all group shadow-sm">
    <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">{icon}</div>
    <span className="text-xs font-bold text-slate-300">{label}</span>
  </div>
);

const Dashboard: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { profile, handleFirestoreError } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [records, setRecords] = useState<AccountingRecord[]>([]);

  useEffect(() => {
    if (!profile) return;

    const qAnnouncements = query(collection(db, 'announcements'), orderBy('date', 'desc'), limit(3));
    const unsubscribeAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (error) => {
      handleFirestoreError(error, 'list' as any, 'announcements');
    });

    const qEvents = query(collection(db, 'calendar_events'), orderBy('startDate', 'asc'), limit(3));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent)));
    }, (error) => {
      handleFirestoreError(error, 'list' as any, 'calendar_events');
    });

    const qRecords = query(collection(db, 'accounting'), orderBy('date', 'desc'), limit(5));
    const unsubscribeRecords = onSnapshot(qRecords, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountingRecord)));
    }, (error) => {
      handleFirestoreError(error, 'list' as any, 'accounting');
    });

    return () => {
      unsubscribeAnnouncements();
      unsubscribeEvents();
      unsubscribeRecords();
    };
  }, [profile]);

  const unreadAnnouncements = announcements.filter(a => !a.readBy?.includes(profile?.uid || ''));

  const handleMarkAsRead = async (announcement: Announcement) => {
    if (!profile || announcement.readBy?.includes(profile.uid)) {
      setActiveTab('announcements');
      return;
    }

    try {
      await updateDoc(doc(db, 'announcements', announcement.id), {
        readBy: arrayUnion(profile.uid)
      });
      setActiveTab('announcements');
    } catch (error) {
      console.error("Error marking as read:", error);
      setActiveTab('announcements');
    }
  };

  const roleLabel = profile?.role === 'manager' ? '管理者' : 
                    profile?.role === 'accountant' ? '会計' : 
                    profile?.role === 'asst_accountant' ? '会計補佐' :
                    profile?.role === 'asst_manager' ? '管理補佐' : '一般居住者';

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Hero Section */}
        <div className="md:col-span-8 bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[2.5rem] p-8 md:p-12 border border-indigo-500/20 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <Building2 className="absolute right-[-2rem] bottom-[-2rem] w-64 h-64 text-white/5 transition-transform group-hover:scale-110 duration-700" />
          <div className="relative z-10 h-full flex flex-col">
            <span className="inline-block px-4 py-1.5 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-full border border-white/10 mb-6 backdrop-blur-md">マンション管理ポータル</span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-8 leading-tight tracking-tighter">おかえりなさい、<br className="hidden sm:block"/>{profile?.name || 'ユーザー'}様。</h2>
            <div className="flex flex-wrap gap-3 mt-auto">
              <div className="px-5 py-2.5 bg-slate-950/40 rounded-2xl text-xs font-black border border-white/5 backdrop-blur-md text-indigo-200">{profile?.roomNumber || '---'}部屋番号</div>
              <div className="px-5 py-2.5 bg-slate-950/40 rounded-2xl text-xs font-black border border-white/5 backdrop-blur-md text-indigo-200">駐車場: {profile?.parking || '無'}</div>
              <div className="px-5 py-2.5 bg-white text-slate-900 rounded-2xl text-xs font-black shadow-xl uppercase tracking-widest">{roleLabel}</div>
            </div>
          </div>
        </div>

        {/* Notifications Counter */}
        <div className="md:col-span-4 glass-card p-8 flex flex-col items-center justify-center text-center">
          <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] mb-4">最新のお知らせ</p>
          <div className="text-7xl font-black text-white mb-4 tracking-tighter tabular-nums">
            {unreadAnnouncements.length.toString().padStart(2, '0')}
          </div>
          <div className="w-12 h-1.5 bg-indigo-600 rounded-full opacity-50"></div>
          <p className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {unreadAnnouncements.length > 0 ? `${unreadAnnouncements.length}件の未読があります` : '未読の通知はありません'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-5 gap-6">
          <QuickAction icon={<Users className="text-indigo-400" size={20}/>} label="名簿確認" onClick={() => setActiveTab('members')} />
          <QuickAction icon={<Bell className="text-orange-400" size={20}/>} label="お知らせ" onClick={() => setActiveTab('announcements')} />
          <QuickAction 
            icon={<MessageSquare className="text-rose-400" size={20}/>} 
            label="問い合わせ" 
            onClick={() => setActiveTab(profile?.role === 'manager' || profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com' ? 'admin' : 'inquiries')} 
          />
          <QuickAction icon={<CreditCard className="text-emerald-400" size={20}/>} label="会計・決算" onClick={() => setActiveTab('accounting')} />
          {profile?.role === 'manager' && <QuickAction icon={<Settings className="text-slate-400" size={20}/>} label="システム設定" onClick={() => setActiveTab('admin')} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Announcements */}
        <div className="glass-card flex flex-col">
          <div className="p-8 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xl font-black flex items-center gap-3 text-white">
              <Bell className="text-indigo-500" size={24} />
              お知らせ
            </h3>
            <button onClick={() => setActiveTab('announcements')} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">すべて見る</button>
          </div>
          <div className="p-6 space-y-4">
            {announcements.map(announcement => (
              <div 
                key={announcement.id} 
                onClick={() => handleMarkAsRead(announcement)}
                className={`p-5 rounded-[1.5rem] border transition-all cursor-pointer group ${
                  !announcement.readBy?.includes(profile?.uid || '') 
                  ? 'bg-indigo-500/10 border-indigo-500/30' 
                  : 'bg-slate-950/40 border-slate-800'
                } hover:border-indigo-500/50`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {!announcement.readBy?.includes(profile?.uid || '') && (
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                    )}
                    <h4 className="font-black text-white group-hover:text-indigo-400 transition-colors">{announcement.title}</h4>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono font-bold">{announcement.date}</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{announcement.content}</p>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-slate-600 text-sm font-bold italic">お知らせはありません</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="glass-card flex flex-col">
          <div className="p-8 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xl font-black flex items-center gap-3 text-white">
              <CalendarIcon className="text-emerald-500" size={24} />
              今後の予定
            </h3>
            <button onClick={() => setActiveTab('calendar')} className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest">すべて見る</button>
          </div>
          <div className="p-6 space-y-4">
            {events.map(event => (
              <div key={event.id} className="flex gap-5 p-5 bg-slate-950/40 rounded-[1.5rem] border border-slate-800 hover:border-emerald-500/30 transition-all group">
                <div className="flex flex-col items-center justify-center w-14 h-14 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
                  <span className="text-[10px] font-black uppercase tracking-tighter">{new Date(event.startDate).toLocaleDateString('ja-JP', { month: 'short' })}</span>
                  <span className="text-xl font-black leading-none">{new Date(event.startDate).getDate()}</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-white text-sm group-hover:text-emerald-400 transition-colors">{event.title}</h4>
                  <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">
                    {new Date(event.startDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 〜
                  </p>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-slate-600 text-sm font-bold italic">予定はありません</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

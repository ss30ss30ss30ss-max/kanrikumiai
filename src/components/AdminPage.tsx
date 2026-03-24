import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, limit, deleteDoc, getDoc, where, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { Settings, Shield, UserCheck, History, Search, Check, X, ShieldCheck, ShieldAlert, Activity, Trash2, MessageSquare } from 'lucide-react';
import { UserProfile, SystemLog, ParkingSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Inquiries from './Inquiries';

const AdminPage: React.FC = () => {
  const { profile, handleFirestoreError } = useAuth();
  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin' || isMasterAdmin;
  const isAdmin = profile?.role === 'admin' || isMasterAdmin;
  const isPrivileged = profile && (['manager', 'admin', 'accountant', 'asst_manager', 'asst_accountant'].includes(profile.role) || isMasterAdmin);

  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'inquiries' | 'logs' | 'settings'>(isManager ? 'users' : 'inquiries');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [parkingSettings, setParkingSettings] = useState<ParkingSettings>({ isPublic: false });
  const [searchTerm, setSearchTerm] = useState('');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logTab, setLogTab] = useState<'all' | 'access' | 'operation'>('all');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState<{ uid: string; name: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isPrivileged) return;

    let unsubUsers = () => {};
    if (isManager) {
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        const userList = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        // Sort by room number
        userList.sort((a, b) => {
          const roomA = a.roomNumber || '9999';
          const roomB = b.roomNumber || '9999';
          return roomA.localeCompare(roomB, undefined, { numeric: true });
        });
        setUsers(userList);
      }, (err) => handleFirestoreError(err, 'get' as any, 'users', auth.currentUser));
    }

    let unsubLogs = () => {};
    if (isAdmin) {
      const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
      unsubLogs = onSnapshot(qLogs, (snap) => {
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemLog)));
      }, (err) => handleFirestoreError(err, 'get' as any, 'logs', auth.currentUser));
    }

    const unsubParking = onSnapshot(doc(db, 'settings', 'parking'), (docSnap) => {
      if (docSnap.exists()) {
        setParkingSettings(docSnap.data() as ParkingSettings);
      }
    });

    // Log cleanup: Delete logs older than 1 year
    const cleanupLogs = async () => {
      if (!isAdmin) return;
      try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oneYearAgoIso = oneYearAgo.toISOString();

        const oldLogsQuery = query(
          collection(db, 'logs'),
          where('timestamp', '<', oneYearAgoIso)
        );

        const snapshot = await getDocs(oldLogsQuery);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${snapshot.size} old logs.`);
      } catch (error) {
        console.error("Log cleanup error:", error);
      }
    };

    cleanupLogs();

    return () => {
      unsubUsers();
      unsubLogs();
      unsubParking();
    };
  }, [isPrivileged, isMasterAdmin]);

  const handleRoleChange = async (uid: string, role: string) => {
    const targetUser = users.find(u => u.uid === uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      if (auth.currentUser) {
        await logAction('権限変更', `${targetUser?.roomNumber || '管理者'}（${targetUser?.name || '未設定'}）の役割を「${role}」に変更しました`, auth.currentUser.uid);
      }
    } catch (error) {
      console.error("Role change error:", error);
    }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (uid === auth.currentUser?.uid) {
      setAlertMessage('自分自身のアカウントは削除できません。');
      setIsAlertOpen(true);
      return;
    }
    
    const targetUser = users.find(u => u.uid === uid);
    const isTargetMasterAdmin = targetUser?.email === 'admin@smart-management.local' || targetUser?.email === 'ss30ss30ss30ss@gmail.com';
    if (isTargetMasterAdmin) {
      setAlertMessage('システム管理アカウントは削除できません。');
      setIsAlertOpen(true);
      return;
    }

    setUserToDelete({ uid, name });
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    const { uid, name } = userToDelete;
    const targetUser = users.find(u => u.uid === uid);

    const isTargetMasterAdmin = targetUser?.email === 'admin@smart-management.local' || targetUser?.email === 'ss30ss30ss30ss@gmail.com';
    if (isTargetMasterAdmin) {
      setAlertMessage('システム管理アカウントは削除できません。');
      setIsAlertOpen(true);
      setUserToDelete(null);
      setIsConfirmOpen(false);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', uid));
      
      // Also clear room_registry if this user was the active one
      if (targetUser?.roomNumber) {
        const registryDoc = await getDoc(doc(db, 'room_registry', targetUser.roomNumber));
        if (registryDoc.exists() && registryDoc.data().uid === uid) {
          await deleteDoc(doc(db, 'room_registry', targetUser.roomNumber));
        }
      }

      if (auth.currentUser) {
        await logAction('アカウント削除', `${targetUser?.roomNumber || '管理者'}（${name || '未設定'}）のアカウントを削除しました`, auth.currentUser.uid);
      }
      setUserToDelete(null);
    } catch (error) {
      console.error("Delete user error:", error);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.roomNumber && u.roomNumber.includes(searchTerm))
  );

  const filteredLogs = logs.filter(log => {
    const matchesTab = logTab === 'all' || (logTab === 'access' ? (log.action === 'ログイン' || log.action === 'ログアウト' || log.action === '利用申請') : !(log.action === 'ログイン' || log.action === 'ログアウト' || log.action === '利用申請'));
    const matchesSearch = log.action.toLowerCase().includes(logSearchTerm.toLowerCase()) || 
                         log.details.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
                         (log.email && log.email.toLowerCase().includes(logSearchTerm.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  if (!isPrivileged) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
          <ShieldAlert size={40} />
        </div>
        <div className="text-center">
          <h3 className="text-2xl font-black text-white">アクセス拒否</h3>
          <p className="text-slate-500 mt-2 font-medium">このページはシステム管理者専用です。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">システム管理</h2>
          <p className="text-slate-500 mt-2 font-medium">ユーザーアカウントの承認、権限設定、および操作履歴の確認を行います。</p>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
          {isManager && (
            <button 
              onClick={() => setActiveAdminTab('users')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeAdminTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <ShieldCheck size={16} />
              ユーザー管理
            </button>
          )}
          <button 
            onClick={() => setActiveAdminTab('inquiries')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeAdminTab === 'inquiries' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <MessageSquare size={16} />
            問い合わせ管理
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveAdminTab('logs')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeAdminTab === 'logs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Activity size={16} />
              システムログ
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveAdminTab('settings')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeAdminTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Settings size={16} />
              設定
            </button>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeAdminTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="flex justify-end">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="ユーザーを検索..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
                />
              </div>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-black flex items-center gap-3 text-white">
                  <ShieldCheck size={24} className="text-indigo-500" />
                  アカウント管理
                </h3>
                <span className="px-4 py-1.5 rounded-full bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-800">
                  {users.length} ユーザー
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-4">ユーザー</th>
                      <th className="px-8 py-4">役割</th>
                      <th className="px-8 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-black text-indigo-400">
                              {u.name?.[0] || u.email[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-white group-hover:text-indigo-400 transition-colors">{u.name || '未設定'}</p>
                              <p className="text-[10px] text-indigo-400 font-black mt-1 uppercase tracking-widest">部屋: {u.roomNumber || '管理者'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          >
                            <option value="resident">居住者</option>
                            <option value="manager">管理人</option>
                            <option value="admin">システム管理者</option>
                            <option value="accountant">会計</option>
                            <option value="asst_accountant">会計補佐</option>
                            <option value="asst_manager">管理補佐</option>
                          </select>
                        </td>
                        <td className="px-8 py-6 text-right flex items-center justify-end gap-2">
                          {isAdmin && (
                            <button 
                              onClick={() => setSelectedUser(u)}
                              className="p-3 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10 rounded-2xl transition-all border border-transparent hover:border-indigo-400/20"
                              title="詳細を表示"
                            >
                              <Search size={20} />
                            </button>
                          )}
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteUser(u.uid, u.name || '')}
                              className="p-3 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all border border-transparent hover:border-rose-500/20"
                              title="アカウント削除"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <AnimatePresence>
              {selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-10 w-full max-w-lg shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-black text-white flex items-center gap-3">
                        <ShieldCheck className="text-indigo-500" />
                        ユーザー詳細
                      </h3>
                      <button onClick={() => setSelectedUser(null)} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">お名前</p>
                          <p className="text-white font-black">{selectedUser.name || '未設定'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">部屋番号</p>
                          <p className="text-indigo-400 font-mono font-black">{selectedUser.roomNumber || '未設定'}</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">メールアドレス</p>
                        <p className="text-white font-medium">{selectedUser.email}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">電話番号</p>
                          <p className="text-white font-medium">{selectedUser.phone || '未登録'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">駐車場番号</p>
                          <p className="text-white font-medium">{selectedUser.parking || '未登録'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">権限</p>
                          <p className="text-white font-black uppercase">{selectedUser.role}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">登録日</p>
                          <p className="text-slate-400 text-xs font-mono">{new Date(selectedUser.createdAt).toLocaleDateString('ja-JP')}</p>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-800">
                        <button 
                          onClick={() => setSelectedUser(null)}
                          className="w-full h-14 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black transition-all"
                        >
                          閉じる
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeAdminTab === 'inquiries' && (
          <motion.div 
            key="inquiries"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-[calc(100vh-250px)]"
          >
            <Inquiries />
          </motion.div>
        )}

        {activeAdminTab === 'logs' && (
          <motion.div 
            key="logs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="glass-card flex flex-col h-[700px]">
              <div className="p-8 border-b border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                  <h3 className="text-xl font-black flex items-center gap-3 text-white">
                    <Activity size={24} className="text-indigo-500" />
                    ログ履歴
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="ログを検索..." 
                      value={logSearchTerm}
                      onChange={(e) => setLogSearchTerm(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
                    />
                  </div>
                </div>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button 
                    onClick={() => setLogTab('all')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${logTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >全て</button>
                  <button 
                    onClick={() => setLogTab('access')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${logTab === 'access' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >アクセス</button>
                  <button 
                    onClick={() => setLogTab('operation')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${logTab === 'operation' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >操作</button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-5 bg-slate-950/50 rounded-[1.5rem] border border-slate-800 hover:border-indigo-500/30 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        log.action === 'ログイン' ? 'text-emerald-400' : 
                        log.action === 'ログアウト' ? 'text-amber-400' : 
                        log.action === '利用申請' ? 'text-indigo-400' : 'text-slate-400'
                      }`}>{log.action}</span>
                      <span className="text-[10px] font-bold text-slate-600">{new Date(log.timestamp).toLocaleTimeString('ja-JP')}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">{log.details}</p>
                    <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">UID: {log.uid.slice(0, 8)}...</span>
                        {log.email && <span className="text-[8px] font-bold text-indigo-400/60 lowercase tracking-tight">{log.email}</span>}
                      </div>
                      <span className="text-[8px] font-bold text-slate-600">{new Date(log.timestamp).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <div className="p-20 text-center text-slate-600 font-bold italic">履歴がありません。</div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeAdminTab === 'settings' && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="glass-card p-8">
              <h3 className="text-xl font-black flex items-center gap-3 text-white mb-8">
                <Settings size={24} className="text-indigo-500" />
                システム設定
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 bg-slate-950/50 rounded-3xl border border-slate-800">
                  <div>
                    <h4 className="text-lg font-black text-white">来客用駐車場予約の公開</h4>
                    <p className="text-sm text-slate-500 font-medium">居住者向けに駐車場予約機能を公開するかどうかを設定します。</p>
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'settings', 'parking'), { isPublic: !parkingSettings.isPublic });
                        await logAction('設定変更', `駐車場予約の公開設定を${!parkingSettings.isPublic ? '公開' : '非公開'}に変更しました`, auth.currentUser?.uid || '');
                      } catch (error) {
                        handleFirestoreError(error, 'update' as any, 'settings/parking');
                      }
                    }}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${parkingSettings.isPublic ? 'bg-indigo-600' : 'bg-slate-800'}`}
                  >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${parkingSettings.isPublic ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="アカウントの削除"
        message={`ユーザー「${userToDelete?.name || '未設定'}」のアカウントを削除してもよろしいですか？この操作は取り消せません。`}
      />

      <ConfirmModal
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        onConfirm={() => setIsAlertOpen(false)}
        title="通知"
        message={alertMessage}
        confirmText="OK"
        showCancel={false}
        variant="info"
      />
    </div>
  );
};

export default AdminPage;

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, limit, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { Settings, Shield, UserCheck, History, Search, Check, X, ShieldCheck, ShieldAlert, Activity, Trash2, MessageSquare } from 'lucide-react';
import { UserProfile, SystemLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import Inquiries from './Inquiries';

const AdminPage: React.FC = () => {
  const { profile, handleFirestoreError } = useAuth();
  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isPrivileged = profile && (['manager', 'admin', 'accountant', 'asst_manager', 'asst_accountant'].includes(profile.role) || isMasterAdmin);

  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'inquiries' | 'logs'>(isMasterAdmin ? 'users' : 'inquiries');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [logTab, setLogTab] = useState<'all' | 'access' | 'operation'>('all');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState<{ uid: string; name: string } | null>(null);

  useEffect(() => {
    if (!isPrivileged) return;

    let unsubUsers = () => {};
    if (isMasterAdmin) {
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      }, (err) => handleFirestoreError(err, 'get' as any, 'users', auth.currentUser));
    }

    let unsubLogs = () => {};
    if (isMasterAdmin) {
      const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
      unsubLogs = onSnapshot(qLogs, (snap) => {
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemLog)));
      }, (err) => handleFirestoreError(err, 'get' as any, 'logs', auth.currentUser));
    }

    return () => {
      unsubUsers();
      unsubLogs();
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
    if (logTab === 'all') return true;
    const isAccess = log.action === 'ログイン' || log.action === 'ログアウト' || log.action === '利用申請';
    if (logTab === 'access') return isAccess;
    return !isAccess;
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
          {isMasterAdmin && (
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
          {isMasterAdmin && (
            <button 
              onClick={() => setActiveAdminTab('logs')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeAdminTab === 'logs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Activity size={16} />
              システムログ
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
                        <td className="px-8 py-6 text-right">
                          <button 
                            onClick={() => handleDeleteUser(u.uid, u.name || '')}
                            className="p-3 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all border border-transparent hover:border-rose-500/20"
                            title="アカウント削除"
                          >
                            <Trash2 size={20} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
                <h3 className="text-xl font-black flex items-center gap-3 text-white mb-6">
                  <Activity size={24} className="text-indigo-500" />
                  ログ履歴
                </h3>
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

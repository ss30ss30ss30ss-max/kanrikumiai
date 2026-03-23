import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { UserCheck, Check, X, ShieldCheck, AlertCircle, Trash2 } from 'lucide-react';
import { UserProfile } from '../types';
import { AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';

const AccountApproval: React.FC = () => {
  const { profile, user, handleFirestoreError } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [userToReject, setUserToReject] = useState<{ uid: string; name: string } | null>(null);

  useEffect(() => {
    const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
    const isPrivileged = profile && (['manager', 'admin', 'accountant', 'asst_manager', 'asst_accountant'].includes(profile.role) || isMasterAdmin);
    if (!profile || !isPrivileged) return;

    const q = query(collection(db, 'users'), where('isApproved', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setPendingUsers(users);
      
      // Initialize selected roles
      const roles: Record<string, string> = {};
      users.forEach(u => {
        roles[u.uid] = u.role || 'resident';
      });
      setSelectedRoles(prev => ({ ...roles, ...prev }));
    }, (err) => handleFirestoreError(err, 'get' as any, 'users', auth.currentUser));

    return () => unsubscribe();
  }, [profile]);

  const handleApprove = async (uid: string) => {
    const targetUser = pendingUsers.find(u => u.uid === uid);
    const role = selectedRoles[uid] || 'resident';
    try {
      await updateDoc(doc(db, 'users', uid), { 
        isApproved: true,
        role: role
      });
      if (user) {
        await logAction('アカウント承認', `${targetUser?.roomNumber || '不明'}号室（${targetUser?.name || '未設定'}）を「${role}」として承認しました`, user.uid);
      }
    } catch (error) {
      console.error("Approval error:", error);
    }
  };

  const handleReject = async (uid: string, name: string) => {
    setUserToReject({ uid, name });
    setIsConfirmOpen(true);
  };

  const confirmReject = async () => {
    if (!userToReject) return;
    const { uid, name } = userToReject;
    const targetUser = pendingUsers.find(u => u.uid === uid);
    
    // Check if target user is a master admin
    const isTargetMasterAdmin = targetUser?.email === 'admin@smart-management.local' || targetUser?.email === 'ss30ss30ss30ss@gmail.com';
    if (isTargetMasterAdmin) {
      alert("システム管理アカウントは削除できません。");
      setIsConfirmOpen(false);
      setUserToReject(null);
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

      if (user) {
        await logAction('アカウント却下', `${targetUser?.roomNumber || '不明'}号室（${name || '未設定'}）の申請を却下し削除しました`, user.uid);
      }
      setUserToReject(null);
    } catch (error) {
      console.error("Reject error:", error);
    }
  };

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isPrivileged = profile && (['manager', 'admin', 'accountant', 'asst_manager', 'asst_accountant'].includes(profile.role) || isMasterAdmin);

  if (!isPrivileged) {
    return (
      <div className="p-12 text-center">
        <AlertCircle className="mx-auto text-rose-500 mb-4" size={48} />
        <h3 className="text-xl font-black text-white">アクセス権限がありません</h3>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-4xl font-black tracking-tighter text-white">アカウント承認</h2>
        <p className="text-slate-500 mt-2 font-medium">新規利用申請のあった居住者のアカウントを承認します。</p>
      </header>

      <div className="glass-card overflow-hidden">
        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xl font-black flex items-center gap-3 text-white">
            <UserCheck size={24} className="text-indigo-500" />
            承認待ちユーザー
          </h3>
          <span className="px-4 py-1.5 rounded-full bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-800">
            {pendingUsers.length} 件
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <th className="px-8 py-4">部屋番号</th>
                <th className="px-8 py-4">氏名</th>
                <th className="px-8 py-4">付与する役割</th>
                <th className="px-8 py-4">申請日</th>
                <th className="px-8 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {pendingUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-8 py-6">
                    <span className="inline-flex items-center justify-center px-4 py-1.5 bg-slate-950 rounded-xl text-xs font-mono font-black text-indigo-400 border border-slate-800">
                      {u.roomNumber || '---'}
                    </span>
                  </td>
                  <td className="px-8 py-6 font-black text-white">{u.name || '未設定'}</td>
                  <td className="px-8 py-6">
                    <select
                      value={selectedRoles[u.uid] || 'resident'}
                      onChange={(e) => setSelectedRoles(prev => ({ ...prev, [u.uid]: e.target.value }))}
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
                  <td className="px-8 py-6 text-xs text-slate-500 font-medium">
                    {new Date(u.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleApprove(u.uid)}
                        className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                        title="承認する"
                      >
                        <Check size={20} />
                      </button>
                      <button
                        onClick={() => handleReject(u.uid, u.name || '')}
                        className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl hover:bg-rose-500/20 transition-all border border-rose-500/20"
                        title="却下・削除"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-600 font-bold italic">
                    承認待ちのユーザーはいません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setUserToReject(null);
        }}
        onConfirm={confirmReject}
        title="申請の却下"
        message={`ユーザー「${userToReject?.name || '未設定'}」の申請を却下し、データを削除しますか？`}
      />
    </div>
  );
};

export default AccountApproval;

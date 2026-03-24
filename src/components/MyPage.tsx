import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { User, Mail, Phone, Home, Car, Lock, Save, ShieldAlert, CheckCircle2, Users, Search, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';

const MyPage: React.FC = () => {
  const { profile, user, handleFirestoreError, showAlert } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin' || isMasterAdmin;
  const isAdmin = profile?.role === 'admin' || isMasterAdmin;

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, 'list' as any, 'users');
    });

    return () => unsubscribe();
  }, [isManager]);

  // Profile state
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    parking: profile?.parking || '',
  });

  // Password state
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: formData.name,
        phone: formData.phone,
        parking: formData.parking,
      });

      await logAction('プロフィール更新', 'ユーザーが自身のプロフィールを更新しました', user.uid);
      showAlert('更新完了', 'プロフィール情報を更新しました。');
    } catch (error) {
      handleFirestoreError(error, 'update' as any, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (passwords.new !== passwords.confirm) {
      showAlert('エラー', '新しいパスワードが一致しません。');
      return;
    }

    if (passwords.new.length < 6) {
      showAlert('エラー', 'パスワードは6文字以上で入力してください。');
      return;
    }

    setPasswordLoading(true);

    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, passwords.current);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, passwords.new);
      
      await logAction('パスワード変更', 'ユーザーがパスワードを変更しました', user.uid);
      showAlert('変更完了', 'パスワードを正常に変更しました。');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        showAlert('エラー', '現在のパスワードが正しくありません。');
      } else {
        showAlert('エラー', `パスワードの変更に失敗しました: ${error.message}`);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header>
        <h2 className="text-4xl font-black tracking-tighter text-white">マイページ</h2>
        <p className="text-slate-500 mt-2 font-medium">アカウント情報の確認と変更、パスワードの管理を行います。</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <User size={24} />
            </div>
            <h3 className="text-xl font-black text-white">プロフィール設定</h3>
          </div>

          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">部屋番号（変更不可）</label>
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-slate-500">
                <Home size={18} />
                <span className="font-medium">{profile?.roomNumber || '未設定'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">お名前</label>
              <div className="relative">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field pl-12"
                  placeholder="お名前を入力"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">電話番号</label>
              <div className="relative">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field pl-12"
                  placeholder="電話番号を入力"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">駐車場番号</label>
              <div className="relative">
                <Car className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  value={formData.parking}
                  onChange={(e) => setFormData({ ...formData, parking: e.target.value })}
                  className="input-field pl-12"
                  placeholder="駐車場番号を入力"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-2xl font-black shadow-lg shadow-indigo-900/40 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={20} />
                  <span>プロフィールを保存</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Password Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Lock size={24} />
            </div>
            <h3 className="text-xl font-black text-white">パスワード変更</h3>
          </div>

          <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-start gap-3">
            <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-slate-400 leading-relaxed">
              セキュリティ保護のため、パスワードの変更には現在のパスワードによる再認証が必要です。
            </p>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">現在のパスワード</label>
              <input
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">新しいパスワード</label>
              <input
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                className="input-field"
                placeholder="6文字以上"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">新しいパスワード（確認）</label>
              <input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                className="input-field"
                placeholder="もう一度入力"
                required
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full h-14 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2"
            >
              {passwordLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  <span>パスワードを更新</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>

    </div>
  );
};

export default MyPage;

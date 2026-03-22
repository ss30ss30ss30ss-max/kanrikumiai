import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, ShieldCheck, Settings, Home, Lock, ArrowRight, ArrowLeft, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';

const AuthLayout: React.FC<{ children: React.ReactNode, title: string, subtitle: string }> = ({ children, title, subtitle }) => (
  <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
    <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-slate-800/30 rounded-full blur-[120px] pointer-events-none" />
    
    <div className="w-full max-w-[420px] z-10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/60 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl shadow-black border border-slate-800 p-8 md:p-10 text-white"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-indigo-600 to-slate-800 rounded-2xl shadow-inner border border-indigo-400/20 mb-4">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{title}</h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base font-medium">{subtitle}</p>
        </div>
        {children}
      </motion.div>
    </div>
  </div>
);

const LoginPage: React.FC = () => {
  const { handleFirestoreError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [parking, setParking] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Secret admin login
  const [clickCount, setClickCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCode, setAdminCode] = useState('');

  useEffect(() => {
    if (clickCount > 0) {
      const timer = setTimeout(() => setClickCount(0), 2000);
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  const toHalfWidth = (str: string) => {
    return str.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
              .replace(/　/g, ' ');
  };

  const handleSecretClick = () => {
    const newCount = clickCount + 1;
    if (newCount >= 5) {
      setShowAdminLogin(true);
      setClickCount(0);
    } else {
      setClickCount(newCount);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const sanitizedCode = toHalfWidth(adminCode);
    if (sanitizedCode === '880818') {
      try {
        // Log in as a master admin account
        // We use a fixed email for the master admin
        const adminEmail = 'admin@smart-management.local';
        const adminPassword = 'admin_password_880818';
        
        try {
          const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
          await logAction('ログイン', 'システム管理者としてログインしました', userCredential.user.uid);
        } catch (err: any) {
          // If admin account doesn't exist, create it (first time setup)
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
            await setDoc(doc(db, 'users', userCredential.user.uid), {
              uid: userCredential.user.uid,
              email: adminEmail,
              name: 'システム管理者',
              role: 'manager',
              isApproved: true,
              createdAt: new Date().toISOString(),
            });
            await logAction('アカウント作成', 'システム管理者が初期作成されました', userCredential.user.uid);
            await logAction('ログイン', 'システム管理者として初回ログインしました', userCredential.user.uid);
          } else {
            throw err;
          }
        }
      } catch (err: any) {
        setError('管理者認証に失敗しました: ' + err.message);
      }
    } else {
      setError('無効な管理者コードです');
    }
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const sanitizedRoom = toHalfWidth(roomNumber);
    const dummyEmail = `room_${sanitizedRoom}@smart-management.local`;

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, dummyEmail, password);
        await logAction('ログイン', `${sanitizedRoom}号室としてログインしました`, userCredential.user.uid);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, password);
        const user = userCredential.user;
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: dummyEmail,
          name,
          roomNumber: sanitizedRoom,
          phone: toHalfWidth(phone),
          parking: toHalfWidth(parking),
          role: 'resident',
          isApproved: false,
          createdAt: new Date().toISOString(),
        });
        await logAction('利用申請', `${sanitizedRoom}号室の利用申請が行われました`, user.uid);
        setSuccess(true);
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('室番号またはパスワードが正しくありません。');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('この室番号は既に登録されています。');
      } else if (err.code === 'auth/weak-password') {
        setError('パスワードが短すぎます。6文字以上で設定してください。');
      } else if (err.code === 'auth/network-request-failed') {
        setError('ネットワークエラーが発生しました。接続を確認してください。');
      } else {
        setError('エラーが発生しました: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout title="申請完了" subtitle="確認をお待ちください">
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-emerald-900/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-emerald-500 w-12 h-12" />
          </div>
          <p className="text-slate-400 text-sm mb-8">管理者が内容を確認し、承認を行います。</p>
          <button onClick={() => setSuccess(false)} className="w-full h-14 bg-white text-slate-900 rounded-2xl font-black">ログイン画面へ</button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title={showAdminLogin ? "管理者認証" : "スマート管理"} 
      subtitle={showAdminLogin ? "システムメンテナンスモード" : "マンション管理組合ポータル"}
    >
      {showAdminLogin ? (
        <form onSubmit={handleAdminLogin} className="space-y-5">
          {error && <div className="bg-red-950/30 border border-red-800/50 text-red-400 p-4 rounded-2xl text-xs flex items-center gap-3"><AlertCircle size={16} /> {error}</div>}
          <div className="relative group">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
            <input 
              type="password" 
              required 
              placeholder="管理者認証コード" 
              className="w-full h-14 pl-11 pr-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 outline-none text-white transition-all placeholder:text-indigo-900" 
              value={adminCode} 
              onChange={(e) => setAdminCode(toHalfWidth(e.target.value))} 
              autoFocus 
            />
          </div>
          <button className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl">認証</button>
          <button type="button" onClick={() => setShowAdminLogin(false)} className="w-full text-slate-500 text-sm font-bold text-center">キャンセル</button>
        </form>
      ) : (
        <form onSubmit={handleAuth} className="space-y-5">
          {error && <div className="bg-red-950/30 border border-red-800/50 text-red-400 p-4 rounded-2xl text-xs flex items-center gap-3"><AlertCircle size={16} /> {error}</div>}
          
          <div className="space-y-3">
            <div className="relative group">
              <Home className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" size={18} />
              <input 
                type="text" 
                required 
                placeholder="室番号" 
                className="w-full h-14 pl-11 pr-4 bg-slate-800/40 border border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-white transition-all" 
                value={roomNumber} 
                onChange={(e) => setRoomNumber(toHalfWidth(e.target.value))} 
              />
            </div>

            {!isLogin && (
              <>
                <div className="relative group">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" size={18} />
                  <input type="text" required placeholder="氏名" className="w-full h-14 pl-11 pr-4 bg-slate-800/40 border border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-white transition-all" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="tel" placeholder="電話番号 (任意)" className="w-full h-12 px-4 bg-slate-800/40 border border-slate-700 rounded-xl outline-none text-white focus:border-indigo-500" value={phone} onChange={(e) => setPhone(toHalfWidth(e.target.value))} />
                  <select 
                    className="w-full h-12 px-4 bg-slate-800/40 border border-slate-700 rounded-xl outline-none text-white focus:border-indigo-500 appearance-none" 
                    value={parking} 
                    onChange={(e) => setParking(e.target.value)}
                  >
                    <option value="">駐車場: 無</option>
                    {Array.from({ length: 40 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num.toString()}>駐車場: {num}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400" size={18} />
              <input type="password" required placeholder="パスワード" className="w-full h-14 pl-11 pr-4 bg-slate-800/40 border border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-white transition-all" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <button disabled={loading} className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            {loading ? "処理中..." : <>{isLogin ? "ログイン" : "利用申請"} <ArrowRight size={18} /></>}
          </button>

          <div className="pt-6 border-t border-slate-800 text-center flex flex-col items-center gap-4">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-slate-400 text-sm font-medium hover:text-indigo-400 transition-colors">
              {isLogin ? "新規利用申請はこちら" : "既にアカウントをお持ちの方"}
            </button>
            <div onClick={handleSecretClick} className="text-[10px] text-slate-800 cursor-default select-none transition-colors hover:text-slate-700">
              © 2024 Smart Management Systems. v2.5.3
            </div>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

export default LoginPage;

import React from 'react';
import { useAuth } from '../AuthContext';
import { ShieldAlert, Clock } from 'lucide-react';
import { auth } from '../firebase';

const ApprovalPending: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock size={40} />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">承認待ち</h1>
        <p className="text-stone-600 mb-6">
          {profile?.name} 様、アカウントの作成ありがとうございます。<br />
          現在、管理者による承認を待っています。承認されるまでしばらくお待ちください。
        </p>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-8 text-left">
          <div className="flex gap-3 text-amber-700">
            <ShieldAlert size={20} className="shrink-0" />
            <p className="text-sm">
              管理組合のセキュリティを確保するため、全ての新規アカウントは管理人の確認が必要です。
            </p>
          </div>
        </div>
        <button
          onClick={() => auth.signOut()}
          className="text-stone-500 hover:text-stone-800 font-medium transition-all"
        >
          ログアウトして戻る
        </button>
      </div>
    </div>
  );
};

export default ApprovalPending;

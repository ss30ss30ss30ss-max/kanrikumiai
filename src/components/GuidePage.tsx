import React from 'react';
import { HelpCircle, LayoutDashboard, Users, Bell, MessageSquare, Calendar, Car, FileText, Wallet, UserCheck, User, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

const GuideSection = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
  <div className="glass-card p-8 space-y-4">
    <div className="flex items-center gap-4 mb-4">
      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
        {icon}
      </div>
      <h3 className="text-xl font-black text-white tracking-tight">{title}</h3>
    </div>
    <div className="text-slate-400 text-sm leading-relaxed space-y-3 font-medium">
      {children}
    </div>
  </div>
);

const GuidePage: React.FC = () => {
  return (
    <div className="space-y-12 pb-20">
      <header>
        <h2 className="text-4xl font-black tracking-tighter text-white">ご利用ガイド</h2>
        <p className="text-slate-500 mt-2 font-medium">スマート管理システムを快適にご利用いただくための説明書です。</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <GuideSection icon={<LayoutDashboard size={24} />} title="ホーム (ダッシュボード)">
          <p>ログイン後、最初に表示される画面です。マンションの全体状況をひと目で把握できます。</p>
          <ul className="list-disc list-inside space-y-1">
            <li>最新のお知らせの確認</li>
            <li>直近の予定（カレンダー）の表示</li>
            <li>各機能へのクイックアクセス</li>
          </ul>
        </GuideSection>

        <GuideSection icon={<Bell size={24} />} title="お知らせ">
          <p>管理組合や管理事務所からの重要な通知を確認できます。</p>
          <ul className="list-disc list-inside space-y-1">
            <li>未読のお知らせにはバッジが表示されます</li>
            <li>詳細画面で内容を確認すると「既読」になります</li>
            <li>添付ファイルがある場合はダウンロード可能です</li>
          </ul>
        </GuideSection>

        <GuideSection icon={<Car size={24} />} title="来客用駐車場予約">
          <p>来客用の駐車場（No.7〜10）をオンラインで予約できます。</p>
          <ul className="list-disc list-inside space-y-1">
            <li>当日を含む14日先まで予約可能です</li>
            <li>予約時には「車両番号（ナンバープレート）」の入力が必須です</li>
            <li>予約の変更・キャンセルは「マイページ」または予約画面から行えます</li>
          </ul>
        </GuideSection>

        <GuideSection icon={<MessageSquare size={24} />} title="問い合わせ">
          <p>管理事務所へ直接メッセージを送ることができます。</p>
          <ul className="list-disc list-inside space-y-1">
            <li>チャット形式でスムーズなやり取りが可能です</li>
            <li>返信があると通知バッジでお知らせします</li>
            <li>過去のやり取りも履歴として保存されます</li>
          </ul>
        </GuideSection>

        <GuideSection icon={<Calendar size={24} />} title="カレンダー">
          <p>マンション内の行事や清掃日、点検予定などを確認できます。</p>
          <ul className="list-disc list-inside space-y-1">
            <li>月間表示で予定を把握できます</li>
            <li>予定をクリックすると詳細を確認できます</li>
          </ul>
        </GuideSection>

        <GuideSection icon={<Users size={24} />} title="名簿確認">
          <p>マンションの居住者情報を確認できます。</p>
          <ul className="list-disc list-inside space-y-1">
            <li>部屋番号順に表示されます</li>
            <li>（管理者のみ）情報の編集や権限の設定が可能です</li>
          </ul>
        </GuideSection>

        <GuideSection icon={<User size={24} />} title="マイページ">
          <p>ご自身の情報の確認と設定変更を行います。</p>
          <ul className="list-disc list-inside space-y-1">
            <li>プロフィールの編集（名前、電話番号など）</li>
            <li>パスワードの変更</li>
            <li>ご自身の予約履歴の確認</li>
          </ul>
        </GuideSection>
      </div>

      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] p-10 space-y-6">
        <div className="flex items-center gap-4">
          <CheckCircle2 className="text-indigo-500" size={32} />
          <h3 className="text-2xl font-black text-white tracking-tight">管理業務向け機能</h3>
        </div>
        <p className="text-slate-400 font-medium leading-relaxed">
          理事会役員や管理スタッフの方は、以下の高度な機能をご利用いただけます。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-black">
              <Wallet size={18} className="text-indigo-400" />
              会計・決算
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">管理費の収支入力、月次・年次報告書の自動生成を行います。</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-black">
              <FileText size={18} className="text-indigo-400" />
              配布用文書
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">議事録や通知書のテンプレートを使用して、PDF文書を簡単に作成できます。</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-black">
              <UserCheck size={18} className="text-indigo-400" />
              アカウント承認
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">新規登録された居住者の本人確認とシステム利用の承認を行います。</p>
          </div>
        </div>
      </div>

      <div className="bg-rose-500/10 border border-rose-500/20 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-8">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
          <AlertCircle size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white tracking-tight">お困りの際は</h3>
          <p className="text-slate-400 font-medium leading-relaxed">
            システムの操作方法について不明な点がある場合や、不具合と思われる挙動が発生した場合は、
            <span className="text-indigo-400 font-bold">「問い合わせ」</span>メニューより管理事務所までご連絡ください。
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;

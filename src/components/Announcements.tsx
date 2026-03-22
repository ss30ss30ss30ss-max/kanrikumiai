import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../AuthContext';
import { Bell, Plus, Trash2, Download, FileText, Calendar as CalendarIcon, Search, Filter } from 'lucide-react';
import { Announcement } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ConfirmModal from './ConfirmModal';

const Announcements: React.FC = () => {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [annToDelete, setAnnToDelete] = useState<string | null>(null);

  const templates = [
    { 
      name: '定期清掃', 
      title: '定期清掃のお知らせ', 
      content: '以下の日程で共用部の定期清掃を実施いたします。\n\n**日時：** 2024年○月○日（○） 9:00〜12:00\n**場所：** 廊下、階段、エントランス\n\n清掃中は足元にご注意ください。ご協力をお願いいたします。' 
    },
    { 
      name: 'ゴミ収集変更', 
      title: 'ゴミ収集日の変更について', 
      content: '祝日のため、以下の通りゴミ収集日が変更となります。\n\n**変更前：** ○月○日（○）\n**変更後：** ○月○日（○）\n\nお間違えのないよう、よろしくお願いいたします。' 
    },
    { 
      name: '理事会開催', 
      title: '第○回 理事会開催のお知らせ', 
      content: '以下の通り理事会を開催いたします。\n\n**日時：** 2024年○月○日（○） 19:00〜\n**場所：** 集会室\n**議題：**\n1. 前回の議事録確認\n2. 今月の収支報告\n3. その他懸案事項' 
    },
    { 
      name: '点検作業', 
      title: '設備点検のお知らせ', 
      content: '以下の日程で設備の点検作業を実施いたします。\n\n**作業内容：** 消防設備点検\n**日時：** 2024年○月○日（○） 10:00〜16:00\n\n作業員が立ち入る場合がございます。ご理解とご協力をお願いいたします。' 
    }
  ];

  const applyTemplate = (template: typeof templates[0]) => {
    setTitle(template.title);
    setContent(template.content);
  };

  const canEdit = profile?.role === 'manager' || profile?.role === 'asst_manager';

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (err) => console.error("Announcements fetch error:", err));
    return unsub;
  }, [profile]);

  const handleDownloadPDF = async (ann: Announcement) => {
    const element = document.getElementById(`announcement-${ann.id}`);
    if (!element) return;

    setIsDownloading(ann.id);
    try {
      // Generate PDF with white background and black text
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        ignoreElements: (el) => el.classList.contains('no-pdf'),
        onclone: (clonedDoc) => {
          // Add a style tag to the clone to override all styles for a clean white PDF
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            #announcement-${ann.id} {
              background-color: #ffffff !important;
              color: #000000 !important;
              padding: 40px !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            #announcement-${ann.id} * {
              background-color: transparent !important;
              color: #000000 !important;
              box-shadow: none !important;
              text-shadow: none !important;
              border-color: #dddddd !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
            #announcement-${ann.id} h2, 
            #announcement-${ann.id} h3, 
            #announcement-${ann.id} h4 {
              color: #000000 !important;
              font-weight: bold !important;
              border-bottom: 2px solid #000000 !important;
              padding-bottom: 10px !important;
              margin-bottom: 20px !important;
            }
            #announcement-${ann.id} .prose p {
              color: #000000 !important;
              line-height: 1.6 !important;
            }
            #announcement-${ann.id} .text-slate-400,
            #announcement-${ann.id} .text-slate-500,
            #announcement-${ann.id} .text-indigo-400 {
              color: #444444 !important;
            }
            /* Hide icons or decorative elements if they look bad in black/white */
            #announcement-${ann.id} .lucide {
              opacity: 0.7 !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`お知らせ_${ann.title}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      setAlertMessage("PDFの作成に失敗しました。");
      setIsAlertOpen(true);
    } finally {
      setIsDownloading(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    try {
      await addDoc(collection(db, 'announcements'), {
        title,
        content,
        date: new Date().toISOString(),
        authorUid: auth.currentUser?.uid,
      });
      setIsModalOpen(false);
      setTitle('');
      setContent('');
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    setAnnToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!annToDelete) return;
    try {
      await deleteDoc(doc(db, 'announcements', annToDelete));
      setAnnToDelete(null);
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">お知らせ</h2>
          <p className="text-slate-500 mt-2 font-medium">管理組合からの重要な連絡事項を掲示します。</p>
        </div>
        <div className="flex gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="お知らせを検索..." 
              className="bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
            />
          </div>
          {canEdit && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-2 font-black text-sm"
            >
              <Plus size={20} />
              <span>作成</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {announcements.map((ann, i) => (
          <motion.article
            key={ann.id}
            id={`announcement-${ann.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card group overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#6366f11a] border border-[#6366f133] flex items-center justify-center text-indigo-400">
                    <Bell size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1">
                        <CalendarIcon size={12} />
                        {new Date(ann.date).toLocaleDateString('ja-JP')}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText size={12} />
                        掲示物
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">{ann.title}</h3>
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => handleDelete(ann.id)} className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all border border-transparent hover:border-red-400/20 no-pdf">
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
              <div className="prose prose-invert max-w-none text-slate-400 leading-relaxed font-medium">
                <ReactMarkdown>{ann.content}</ReactMarkdown>
              </div>
              <div className="mt-8 pt-8 border-t border-slate-800 flex items-center justify-between">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  管理組合 事務局
                </div>
                <button 
                  onClick={() => handleDownloadPDF(ann)}
                  disabled={isDownloading === ann.id}
                  className="flex items-center gap-2 text-indigo-400 font-black text-xs hover:text-indigo-300 transition-colors no-pdf disabled:opacity-50"
                >
                  {isDownloading === ann.id ? (
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download size={18} />
                  )}
                  <span>{isDownloading === ann.id ? '作成中...' : 'PDFで保存'}</span>
                </button>
              </div>
            </div>
          </motion.article>
        ))}
        {announcements.length === 0 && (
          <div className="p-20 rounded-[3rem] border border-dashed border-slate-800 text-center text-slate-500 font-bold italic">
            現在、お知らせはありません。
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-black text-white">お知らせを作成</h3>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">テンプレート</label>
                  <div className="flex flex-wrap gap-2 px-4">
                    {templates.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/20 transition-all"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">タイトル</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input-field"
                    placeholder="例：定期清掃のお知らせ"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">内容（Markdown対応）</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="input-field h-64 resize-none font-mono text-sm leading-relaxed"
                    placeholder="お知らせの詳細を記入してください。Markdown形式が使えます。"
                    required
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 h-14 rounded-2xl border border-slate-800 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                  >キャンセル</button>
                  <button 
                    type="submit" 
                    className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 transition-all"
                  >掲示する</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setAnnToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="お知らせの削除"
        message="このお知らせを削除してもよろしいですか？この操作は取り消せません。"
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

export default Announcements;

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../AuthContext';
import { Bell, Plus, Trash2, Download, FileText, Calendar as CalendarIcon, Search, Filter, CheckCircle2, Loader2, Eye, X } from 'lucide-react';
import { Announcement } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ConfirmModal from './ConfirmModal';

const Announcements: React.FC = () => {
  const { profile, handleFirestoreError } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);
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

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const canEdit = profile && profile.role !== 'resident' && profile.isApproved;

  const markAsRead = async (annId: string) => {
    if (!profile || !auth.currentUser) return;
    const ann = announcements.find(a => a.id === annId);
    if (ann && ann.readBy?.includes(auth.currentUser.uid)) return;

    try {
      await updateDoc(doc(db, 'announcements', annId), {
        readBy: arrayUnion(auth.currentUser.uid)
      });
    } catch (error) {
      handleFirestoreError(error, 'update' as any, `announcements/${annId}`);
    }
  };

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (err) => {
      handleFirestoreError(err, 'list' as any, 'announcements');
    });
    return unsub;
  }, [profile]);

  const handleDownloadPDF = async (ann: Announcement) => {
    setIsDownloading(ann.id);
    try {
      // Create a hidden container for PDF generation
      const printContainer = document.createElement('div');
      printContainer.id = `pdf-print-${ann.id}`;
      printContainer.style.position = 'fixed';
      printContainer.style.left = '-9999px';
      printContainer.style.top = '0';
      printContainer.style.width = '800px';
      printContainer.style.backgroundColor = '#ffffff';
      printContainer.style.color = '#000000';
      printContainer.style.padding = '60px';
      printContainer.style.fontFamily = '"Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';
      
      printContainer.innerHTML = `
        <div style="text-align: right; margin-bottom: 20px; font-size: 12pt;">
          ${new Date(ann.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div style="margin-bottom: 40px; font-size: 14pt; font-weight: bold;">
          居住者各位
        </div>
        <div style="text-align: right; margin-bottom: 60px; font-size: 12pt;">
          マンション管理組合 理事会
        </div>
        <div style="text-align: center; margin-bottom: 60px; font-size: 24pt; font-weight: bold; text-decoration: underline; text-underline-offset: 10px;">
          ${ann.title}
        </div>
        <div style="font-size: 12pt; line-height: 2.0; white-space: pre-wrap; min-height: 400px; margin-bottom: 60px;">
          ${ann.content}
        </div>
        <div style="margin-top: 60px; border-top: 1px solid #000000; padding-top: 20px; text-align: right; font-size: 10pt;">
          お問い合わせ：管理事務室
        </div>
      `;
      
      document.body.appendChild(printContainer);
      
      try {
        // Wait for a bit to ensure rendering
        await new Promise(resolve => setTimeout(resolve, 500));

        // Ensure we are at the top for better capture
        window.scrollTo(0, 0);

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const canvas = await html2canvas(printContainer, {
          scale: isMobile ? 1.5 : 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          allowTaint: true
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        
        // Use a more robust download method for mobile/iframes
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `お知らせ_${ann.title}.pdf`;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup link
        setTimeout(() => {
          if (link.parentNode) link.parentNode.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        
        setPreviewAnnouncement(null);
      } finally {
        // Always remove the print container
        if (printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer);
        }
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      setAlertMessage("PDFの作成に失敗しました。ブラウザの設定や通信状況を確認してください。");
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
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-slate-900">お知らせ</h2>
          <p className="text-slate-500 mt-2 font-medium">管理組合からの重要な連絡事項を掲示します。</p>
        </div>
        <div className="flex gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="お知らせを検索..." 
              className="bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-6 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
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
        {announcements.map((ann, i) => {
          const isRead = ann.readBy?.includes(auth.currentUser?.uid || '');
          return (
            <motion.article
              key={ann.id}
              id={`announcement-${ann.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onViewportEnter={() => !isRead && markAsRead(ann.id)}
              onClick={() => !isRead && markAsRead(ann.id)}
              className={`glass-card group overflow-hidden transition-all cursor-pointer ${!isRead ? 'border-l-4 border-l-indigo-500' : ''}`}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      !isRead 
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/40' 
                      : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
                    }`}>
                      <Bell size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1">
                          <CalendarIcon size={12} />
                          {new Date(ann.date).toLocaleDateString('ja-JP')}
                        </span>
                        {!isRead && (
                          <span className="px-2 py-0.5 bg-indigo-500 text-white rounded-full text-[8px] font-black animate-pulse">NEW</span>
                        )}
                        {isRead && (
                          <span className="flex items-center gap-1 text-emerald-500/60">
                            <CheckCircle2 size={10} />
                            既読
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mt-1 group-hover:text-indigo-400 transition-colors">{ann.title}</h3>
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => handleDelete(ann.id)} className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all border border-transparent hover:border-red-400/20 no-pdf">
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
                <div className="prose max-w-none text-slate-400 leading-relaxed font-medium">
                  <ReactMarkdown>{ann.content}</ReactMarkdown>
                </div>
                <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    管理組合 事務局
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setPreviewAnnouncement(ann)}
                      className="flex items-center gap-2 text-indigo-600 font-black text-xs hover:text-indigo-300 transition-colors no-pdf"
                    >
                      <Download size={18} />
                      <span>プレビュー・保存</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.article>
          );
        })}
        {announcements.length === 0 && (
          <div className="p-20 rounded-[3rem] border border-dashed border-slate-200 text-center text-slate-500 font-bold italic">
            現在、お知らせはありません。
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white border border-slate-200 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-black text-slate-900">お知らせを作成</h3>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
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
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/20 transition-all"
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
                    className="flex-1 h-14 rounded-2xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all"
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
      
      {/* Hidden Formal Document Renderer - Removed */}

      <AnimatePresence>
        {previewAnnouncement && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl">
            <motion.div 
              key="announcement-preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl bg-white border border-slate-200 rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Eye className="text-indigo-500" />
                  お知らせプレビュー
                </h3>
                <button 
                  onClick={() => setPreviewAnnouncement(null)}
                  className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
                <div id={`ann-preview-${previewAnnouncement.id}`} className="bg-white text-black p-12 shadow-2xl mx-auto w-full max-w-[600px] min-h-[800px] flex flex-col font-serif">
                  <div className="text-right mb-8 text-[10px]">
                    {new Date(previewAnnouncement.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="mb-10 text-xs font-bold">
                    居住者各位
                  </div>
                  <div className="text-right mb-12 text-xs">
                    マンション管理組合 理事会
                  </div>
                  
                  <h1 className="text-2xl font-bold text-center mb-12 underline underline-offset-8">{previewAnnouncement.title}</h1>
                  
                  <div className="text-sm leading-relaxed flex-1 whitespace-pre-wrap">
                    {previewAnnouncement.content}
                  </div>
                  
                  <div className="mt-12 pt-4 border-t border-black text-right text-[8px] italic">
                    お問い合わせ：管理事務室
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => handleDownloadPDF(previewAnnouncement)}
                  disabled={isDownloading === previewAnnouncement.id}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {isDownloading === previewAnnouncement.id ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Download size={20} />
                  )}
                  PDFで保存
                </button>
              </div>
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

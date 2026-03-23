import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { DistributionDocument } from '../types';
import { FileText, Plus, Download, Trash2, Edit2, FileCheck, AlertTriangle, Users, Save, Eye, X, Loader2, FileDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ConfirmModal from './ConfirmModal';

const templates = [
  { 
    id: 'notice', 
    name: 'お知らせ', 
    icon: <FileCheck size={20} />,
    defaultTitle: 'お知らせ',
    defaultRecipient: '居住者各位',
    defaultContent: '日頃より当マンションの管理運営にご協力いただき、誠にありがとうございます。\n\n以下の通りお知らせいたします。\n\n1. 内容：\n2. 日時：\n3. 場所：\n\n以上、よろしくお願いいたします。'
  },
  { 
    id: 'meeting', 
    name: '議事録', 
    icon: <Users size={20} />,
    defaultTitle: '第〇回 理事会議事録',
    defaultRecipient: '関係者各位',
    defaultContent: '1. 開催日時：\n2. 開催場所：\n3. 出席者：\n4. 議題：\n   - \n   - \n5. 決議事項：\n   - \n\n次回開催予定：'
  },
  { 
    id: 'request', 
    name: 'お願い・警告', 
    icon: <AlertTriangle size={20} />,
    defaultTitle: '〇〇に関するお願い',
    defaultRecipient: '居住者各位',
    defaultContent: '最近、〇〇に関する苦情が寄せられております。\n\n共同生活のルールを守り、皆様が快適に過ごせるようご協力をお願いいたします。\n\n特に以下の点にご注意ください：\n- \n- \n\n改善が見られない場合は、〇〇の措置を講じる場合がございます。'
  }
];

const DocumentCreator: React.FC = () => {
  const { profile, user, handleFirestoreError } = useAuth();
  const [documents, setDocuments] = useState<DistributionDocument[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete', id: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [downloadPreviewDoc, setDownloadPreviewDoc] = useState<DistributionDocument | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toLocaleDateString('ja-JP'),
    sender: 'マンション管理組合 理事会',
    recipient: '居住者各位',
    content: '',
    footer: 'お問い合わせ：管理事務室（内線：〇〇）',
    template: 'notice' as 'notice' | 'meeting' | 'request'
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DistributionDocument)));
    }, (error) => handleFirestoreError(error, 'list' as any, 'documents'));
    return () => unsubscribe();
  }, [profile]);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        template: templateId as any,
        title: template.defaultTitle,
        recipient: template.defaultRecipient,
        content: template.defaultContent
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'documents', editingId), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        await logAction('文書更新', `文書「${formData.title}」を更新しました`, user.uid);
      } else {
        await addDoc(collection(db, 'documents'), {
          ...formData,
          authorUid: user.uid,
          createdAt: new Date().toISOString()
        });
        await logAction('文書作成', `文書「${formData.title}」を新規作成しました`, user.uid);
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, 'write' as any, 'documents');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      date: new Date().toLocaleDateString('ja-JP'),
      sender: 'マンション管理組合 理事会',
      recipient: '居住者各位',
      content: '',
      footer: 'お問い合わせ：管理事務室（内線：〇〇）',
      template: 'notice'
    });
    setEditingId(null);
  };

  const handleEdit = (doc: DistributionDocument) => {
    setFormData({
      title: doc.title,
      date: doc.date,
      sender: doc.sender,
      recipient: doc.recipient,
      content: doc.content,
      footer: doc.footer || '',
      template: doc.template
    });
    setEditingId(doc.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'documents', id));
      await logAction('文書削除', '文書を削除しました', user.uid);
      setIsConfirmOpen(false);
    } catch (error) {
      handleFirestoreError(error, 'delete' as any, 'documents');
    }
  };

  const handleDownloadPDF = async (docData: DistributionDocument) => {
    setIsGenerating(docData.id);
    try {
      // Create a hidden container for PDF generation
      const printContainer = document.createElement('div');
      printContainer.id = `pdf-print-${docData.id}`;
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
          ${docData.date}
        </div>
        <div style="margin-bottom: 40px; font-size: 14pt; font-weight: bold;">
          ${docData.recipient} 様
        </div>
        <div style="text-align: right; margin-bottom: 60px; font-size: 12pt;">
          ${docData.sender}
        </div>
        <div style="text-align: center; margin-bottom: 60px; font-size: 24pt; font-weight: bold; text-decoration: underline; text-underline-offset: 10px;">
          ${docData.title}
        </div>
        <div style="font-size: 12pt; line-height: 2.0; white-space: pre-wrap; min-height: 400px; margin-bottom: 60px;">
          ${docData.content}
        </div>
        ${docData.footer ? `
          <div style="margin-top: 60px; border-top: 1px solid #000000; padding-top: 20px; text-align: right; font-size: 10pt;">
            ${docData.footer}
          </div>
        ` : ''}
      `;
      
      document.body.appendChild(printContainer);
      
      // Wait for a bit to ensure rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(printContainer, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        allowTaint: true
      });

      document.body.removeChild(printContainer);

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
      pdf.save(`配布文書_${docData.title}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("PDFの作成に失敗しました。ブラウザの設定や通信状況を確認してください。");
    } finally {
      setIsGenerating(null);
    }
  };

  const handleDownloadText = (docData: DistributionDocument) => {
    const text = `
【${docData.title}】

宛先：${docData.recipient}
日付：${docData.date}
差出人：${docData.sender}

--------------------------------------------------

${docData.content}

--------------------------------------------------
${docData.footer || ''}
    `.trim();

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `配布文書_${docData.title}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isManager = profile && (['manager', 'admin', 'asst_manager', 'accountant', 'asst_accountant'].includes(profile.role) || isMasterAdmin);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            <FileText className="text-indigo-500" size={32} />
            配布用文書作成
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">掲示板や配布用の正式な文書を作成・管理します</p>
        </div>
        
        {isManager && (
          <div className="flex gap-3">
            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="btn-primary md:w-auto px-8"
            >
              <Plus size={20} />
              新規文書作成
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.map((doc) => (
          <motion.div 
            key={doc.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card group overflow-hidden flex flex-col"
          >
            <div className="p-6 flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  doc.template === 'notice' ? 'bg-emerald-500/10 text-emerald-400' :
                  doc.template === 'meeting' ? 'bg-indigo-500/10 text-indigo-400' :
                  'bg-orange-500/10 text-orange-400'
                }`}>
                  {templates.find(t => t.id === doc.template)?.icon}
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{doc.date}</span>
              </div>
              
              <h3 className="text-lg font-black text-white mb-2 line-clamp-1">{doc.title}</h3>
              <p className="text-slate-400 text-xs line-clamp-3 leading-relaxed mb-4">
                {doc.content}
              </p>
              
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <Users size={12} />
                <span>宛先: {doc.recipient}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setDownloadPreviewDoc(doc)}
                  className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all"
                  title="プレビュー・ダウンロード"
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={() => { 
                    setFormData({
                      title: doc.title,
                      date: doc.date,
                      sender: doc.sender,
                      recipient: doc.recipient,
                      content: doc.content,
                      footer: doc.footer || '',
                      template: doc.template
                    }); 
                    setIsPreviewOpen(true); 
                  }}
                  className="p-2 text-slate-400 hover:bg-slate-700/30 rounded-xl transition-all"
                  title="プレビュー"
                >
                  <Eye size={18} />
                </button>
              </div>
              
              {isManager && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleEdit(doc)}
                    className="p-2 text-slate-400 hover:bg-slate-700/30 rounded-xl transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => { setConfirmAction({ type: 'delete', id: doc.id }); setIsConfirmOpen(true); }}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 md:p-8 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  {editingId ? <Edit2 size={24} className="text-indigo-500" /> : <Plus size={24} className="text-indigo-500" />}
                  {editingId ? '文書を編集' : '新規文書作成'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:bg-slate-800 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Form */}
                  <div className="space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">テンプレート選択</label>
                      <div className="grid grid-cols-3 gap-3">
                        {templates.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleTemplateSelect(t.id)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                              formData.template === t.id 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40' 
                              : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800'
                            }`}
                          >
                            {t.icon}
                            <span className="text-[10px] font-black">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">日付</label>
                          <input 
                            type="text" 
                            className="input-field h-12 pl-4" 
                            value={formData.date} 
                            onChange={(e) => setFormData({...formData, date: e.target.value})} 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">宛先</label>
                          <input 
                            type="text" 
                            className="input-field h-12 pl-4" 
                            value={formData.recipient} 
                            onChange={(e) => setFormData({...formData, recipient: e.target.value})} 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">差出人</label>
                        <input 
                          type="text" 
                          className="input-field h-12 pl-4" 
                          value={formData.sender} 
                          onChange={(e) => setFormData({...formData, sender: e.target.value})} 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">タイトル</label>
                        <input 
                          type="text" 
                          required
                          className="input-field h-12 pl-4 font-bold" 
                          value={formData.title} 
                          onChange={(e) => setFormData({...formData, title: e.target.value})} 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">本文</label>
                        <textarea 
                          required
                          rows={8}
                          className="w-full p-4 bg-slate-800/40 border border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-white transition-all text-sm leading-relaxed" 
                          value={formData.content} 
                          onChange={(e) => setFormData({...formData, content: e.target.value})} 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">フッター（備考等）</label>
                        <input 
                          type="text" 
                          className="input-field h-12 pl-4 text-xs" 
                          value={formData.footer} 
                          onChange={(e) => setFormData({...formData, footer: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-14 rounded-2xl border border-slate-700 text-slate-400 font-black hover:bg-slate-800 transition-all">キャンセル</button>
                      <button type="submit" className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                        <Save size={20} />
                        {editingId ? '更新して保存' : '保存する'}
                      </button>
                    </div>
                  </form>
                </div>

                  {/* Live Preview Card */}
                  <div className="hidden lg:block">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">リアルタイムプレビュー</label>
                    <div className="bg-white text-black p-10 rounded-xl shadow-2xl font-serif min-h-[600px] transform scale-[0.85] origin-top">
                      <div className="flex justify-between mb-8 text-[10px]">
                        <div>宛先：{formData.recipient}</div>
                        <div className="text-right">
                          <div>{formData.date}</div>
                          <div className="font-bold mt-1">{formData.sender}</div>
                        </div>
                      </div>
                      
                      <h1 className="text-xl font-bold text-center mb-10 underline underline-offset-4">{formData.title}</h1>
                      
                      <div className="text-xs leading-relaxed min-h-[300px] whitespace-pre-wrap">
                        {formData.content}
                      </div>
                      
                      {formData.footer && (
                        <div className="mt-12 pt-2 border-t border-black text-right text-[8px] italic">
                          {formData.footer}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
            <motion.div 
              key="document-full-preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-3xl bg-white text-black p-8 md:p-12 shadow-2xl relative overflow-y-auto max-h-[95vh] rounded-3xl"
            >
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-900 rounded-full hover:bg-slate-200 transition-all no-pdf z-10"
              >
                <X size={24} />
              </button>

              <div id="doc-preview-full" className="space-y-10 bg-white text-black p-4 md:p-8">
                <div className="flex justify-between mb-12 text-sm">
                  <div>宛先：{formData.recipient}</div>
                  <div className="text-right">
                    <div>{formData.date}</div>
                    <div className="font-bold mt-1">{formData.sender}</div>
                  </div>
                </div>
                
                <h1 className="text-3xl font-bold text-center mb-20 underline underline-offset-8">{formData.title}</h1>
                
                <div className="text-lg leading-relaxed min-h-[400px] whitespace-pre-wrap">
                  {formData.content}
                </div>
                
                {formData.footer && (
                  <div className="mt-20 pt-4 border-t border-black text-right text-sm italic">
                    {formData.footer}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => confirmAction?.type === 'delete' && handleDelete(confirmAction.id)}
        title="文書の削除"
        message="この文書を削除してもよろしいですか？この操作は取り消せません。"
        confirmText="削除する"
        variant="danger"
      />

      {/* Download Preview Modal */}
      <AnimatePresence>
        {downloadPreviewDoc && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
            <motion.div 
              key="document-download-preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                  <Eye className="text-indigo-500" />
                  ダウンロードプレビュー
                </h3>
                <button 
                  onClick={() => setDownloadPreviewDoc(null)}
                  className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
                <div id={`doc-preview-${downloadPreviewDoc.id}`} className="bg-white text-black p-12 shadow-2xl mx-auto w-full max-w-[600px] min-h-[800px] flex flex-col">
                  <div className="flex justify-between mb-12 text-[10px]">
                    <div>宛先：{downloadPreviewDoc.recipient}</div>
                    <div className="text-right">
                      <div>{downloadPreviewDoc.date}</div>
                      <div className="font-bold mt-1">{downloadPreviewDoc.sender}</div>
                    </div>
                  </div>
                  
                  <h1 className="text-2xl font-bold text-center mb-12 underline underline-offset-8">{downloadPreviewDoc.title}</h1>
                  
                  <div className="text-sm leading-relaxed flex-1 whitespace-pre-wrap">
                    {downloadPreviewDoc.content}
                  </div>
                  
                  {downloadPreviewDoc.footer && (
                    <div className="mt-12 pt-4 border-t border-black text-right text-[8px] italic">
                      {downloadPreviewDoc.footer}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 border-t border-slate-800 bg-slate-900/50 grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleDownloadPDF(downloadPreviewDoc)}
                  disabled={isGenerating === downloadPreviewDoc.id}
                  className="flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {isGenerating === downloadPreviewDoc.id ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Download size={20} />
                  )}
                  PDFで保存
                </button>
                <button
                  onClick={() => handleDownloadText(downloadPreviewDoc)}
                  className="flex items-center justify-center gap-3 py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-700 transition-all"
                >
                  <FileDown size={20} />
                  テキストで保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentCreator;

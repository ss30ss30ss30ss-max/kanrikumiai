import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { AccountingRecord } from '../types';
import { CreditCard, Plus, ArrowUpCircle, ArrowDownCircle, Wallet, Search, Filter, FileDown, Edit2, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ConfirmModal from './ConfirmModal';

const Accounting: React.FC = () => {
  const { profile, handleFirestoreError } = useAuth();
  const [records, setRecords] = useState<AccountingRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isPrivileged = profile && (['manager', 'accountant', 'asst_manager', 'asst_accountant'].includes(profile.role) || isMasterAdmin);

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'accounting'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountingRecord)));
    }, (err) => handleFirestoreError(err, 'get' as any, 'accounting', auth.currentUser));

    return () => unsubscribe();
  }, [profile]);

  const handleGenerateReport = async () => {
    const element = document.getElementById('accounting-report-area-preview');
    if (!element) return;

    setIsGeneratingReport(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        ignoreElements: (el) => el.classList.contains('no-pdf'),
        onclone: (clonedDoc) => {
          // Force light mode on the cloned document to avoid oklab/oklch issues
          clonedDoc.documentElement.style.colorScheme = 'light';
          clonedDoc.body.style.colorScheme = 'light';

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * {
              color-scheme: light !important;
              font-family: "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif !important;
            }
            #accounting-report-area-preview, #accounting-report-area-preview * {
              color-scheme: light !important;
              background-color: transparent !important;
              background-image: none !important;
              color: #000000 !important;
              box-shadow: none !important;
              text-shadow: none !important;
              transition: none !important;
              animation: none !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
              filter: none !important;
              outline: none !important;
              mask: none !important;
              -webkit-mask: none !important;
            }
            #accounting-report-area-preview {
              background-color: #ffffff !important;
              padding: 40px !important;
            }
            #accounting-report-area-preview svg {
              stroke: #000000 !important;
              fill: none !important;
            }
            #accounting-report-area-preview .text-emerald-600 { color: #059669 !important; }
            #accounting-report-area-preview .text-orange-600 { color: #ea580c !important; }
            #accounting-report-area-preview .text-indigo-600 { color: #4f46e5 !important; }
            #accounting-report-area-preview .bg-slate-50 { background-color: #f8fafc !important; }
            #accounting-report-area-preview .border-slate-200 { border-color: #e2e8f0 !important; }
            #accounting-report-area-preview .text-slate-600 { color: #475569 !important; }
            #accounting-report-area-preview .text-slate-500 { color: #64748b !important; }
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
      pdf.save(`収支決算報告書_${new Date().toLocaleDateString('ja-JP')}.pdf`);
      setIsPreviewOpen(false);
    } catch (error) {
      console.error("Report generation error:", error);
      setAlertMessage("決算書の作成に失敗しました。");
      setIsAlertOpen(true);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isPrivileged) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'accounting', editingId), {
          type,
          amount: Number(amount),
          description,
          date,
          updatedBy: profile.uid
        });
        await logAction('会計修正', `「${description}」の記録を修正しました（¥${Number(amount).toLocaleString()}）`, profile.uid);
      } else {
        await addDoc(collection(db, 'accounting'), {
          type,
          amount: Number(amount),
          description,
          date,
          createdBy: profile.uid
        });
        await logAction('会計登録', `「${description}」の記録を新規登録しました（¥${Number(amount).toLocaleString()}）`, profile.uid);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setAmount('');
      setDescription('');
    } catch (err) {
      console.error("Save record error:", err);
    }
  };

  const handleEdit = (record: AccountingRecord) => {
    setEditingId(record.id);
    setType(record.type);
    setAmount(record.amount.toString());
    setDescription(record.description);
    setDate(record.date);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!profile || !isPrivileged) return;
    setRecordToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete || !profile) return;
    const targetRecord = records.find(r => r.id === recordToDelete);

    try {
      await deleteDoc(doc(db, 'accounting', recordToDelete));
      await logAction('会計削除', `「${targetRecord?.description || '不明'}」の記録を削除しました`, profile.uid);
      setRecordToDelete(null);
    } catch (err) {
      console.error("Delete record error:", err);
    }
  };

  const totalIncome = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">会計管理</h2>
          <p className="text-slate-500 mt-2 font-medium">マンションの収支状況を管理・確認できます。</p>
        </div>
        {isPrivileged && (
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl border border-slate-700 transition-all flex items-center gap-2 font-black text-sm"
          >
            <FileDown size={20} />
            <span>決算書作成</span>
          </button>
        )}
      </header>

      <div id="accounting-report-area" className="space-y-6 p-2 md:p-4 rounded-[3rem]">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="report-emerald-gradient rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-white shadow-xl shadow-[#064e3b33] border border-[#10b98133] transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-3 mb-3 md:mb-4 opacity-80">
              <ArrowUpCircle size={18} className="md:w-5 md:h-5" />
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">総収入</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter flex items-baseline gap-1">
              <span className="text-lg md:text-xl opacity-60 font-medium">¥</span>
              {totalIncome.toLocaleString()}
            </div>
          </div>
          <div className="report-orange-gradient rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-white shadow-xl shadow-[#7c2d1233] border border-[#f9731633] transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-3 mb-3 md:mb-4 opacity-80">
              <ArrowDownCircle size={18} className="md:w-5 md:h-5" />
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">総支出</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter flex items-baseline gap-1">
              <span className="text-lg md:text-xl opacity-60 font-medium">¥</span>
              {totalExpense.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-900 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-white shadow-xl border border-slate-800 flex flex-col justify-between sm:col-span-2 lg:col-span-1 transition-transform hover:scale-[1.02]">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-3 opacity-60">
                <Wallet size={18} className="md:w-5 md:h-5" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">現在の残高</span>
              </div>
              {isPrivileged && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/40 no-pdf"
                >
                  <Plus size={18} className="md:w-5 md:h-5" />
                </button>
              )}
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-indigo-400 flex items-baseline gap-1">
              <span className="text-lg md:text-xl opacity-60 font-medium">¥</span>
              {balance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-800 flex items-center justify-between bg-[#0206174d]">
            <h3 className="text-lg md:text-xl font-black flex items-center gap-2">
              <CreditCard className="text-indigo-500" size={20} />
              収支履歴
            </h3>
            <div className="flex gap-2 no-pdf">
              <button className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-slate-500 hover:text-white transition-colors"><Search size={16}/></button>
              <button className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-slate-500 hover:text-white transition-colors"><Filter size={16}/></button>
            </div>
          </div>
          <div className="divide-y divide-slate-800/50">
            {records.map(record => (
              <div key={record.id} className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#1e293b4d] transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center border shrink-0 ${
                    record.type === 'income' 
                    ? 'bg-[#10b9811a] border-[#10b98133] text-emerald-400' 
                    : 'bg-[#f973161a] border-[#f9731633] text-orange-400'
                  }`}>
                    {record.type === 'income' ? <ArrowUpCircle size={20} className="md:w-6 md:h-6" /> : <ArrowDownCircle size={20} className="md:w-6 md:h-6" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-sm md:text-base truncate group-hover:text-indigo-400 transition-colors">{record.description}</h4>
                    <p className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">{record.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className={`text-lg md:text-xl font-black tracking-tighter text-right ${
                    record.type === 'income' ? 'text-emerald-400' : 'text-orange-400'
                  }`}>
                    <span className="text-sm opacity-60 mr-1">{record.type === 'income' ? '+' : '-'}</span>
                    ¥{record.amount.toLocaleString()}
                  </div>
                  {isPrivileged && (
                    <div className="flex items-center gap-2 no-pdf">
                      <button 
                        onClick={() => handleEdit(record)}
                        className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                        title="編集"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(record.id)}
                        className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
                        title="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {records.length === 0 && (
              <div className="p-20 text-center text-slate-500 text-sm italic">履歴がありません。</div>
            )}
          </div>
        </div>
      </div>

      {/* Add Record Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[3rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <h3 className="text-2xl font-black text-white mb-8">{editingId ? '記録を修正' : '収支を記録'}</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex p-1 bg-slate-950 rounded-2xl border border-slate-800">
                  <button 
                    type="button"
                    onClick={() => setType('income')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${type === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-500'}`}
                  >収入</button>
                  <button 
                    type="button"
                    onClick={() => setType('expense')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${type === 'expense' ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/40' : 'text-slate-500'}`}
                  >支出</button>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">金額 (円)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="5000" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">内容</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="管理費、修繕費など" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">日付</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingId(null);
                      setAmount('');
                      setDescription('');
                    }}
                    className="flex-1 h-14 rounded-2xl border border-slate-800 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                  >キャンセル</button>
                  <button 
                    type="submit" 
                    className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 transition-all"
                  >{editingId ? '更新する' : '保存する'}</button>
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
          setRecordToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="記録の削除"
        message="この会計記録を削除してもよろしいですか？この操作は取り消せません。"
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

      {/* Full Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl bg-white text-black p-8 md:p-12 shadow-2xl relative overflow-y-auto max-h-[95vh] rounded-3xl"
            >
              <div className="flex justify-between items-center mb-8 no-pdf sticky top-0 bg-white/80 backdrop-blur-sm py-2 z-10">
                <h3 className="text-xl font-black text-slate-900">決算報告書プレビュー</h3>
                <div className="flex gap-4">
                  <button 
                    onClick={handleGenerateReport}
                    disabled={isGeneratingReport}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                  >
                    {isGeneratingReport ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileDown size={16} />}
                    PDFで保存
                  </button>
                  <button 
                    onClick={() => setIsPreviewOpen(false)}
                    className="p-2.5 bg-slate-100 text-slate-900 rounded-full hover:bg-slate-200 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div id="accounting-report-area-preview" className="space-y-10 bg-white text-black p-4 md:p-8">
                <div className="text-center space-y-4">
                  <h1 className="text-4xl font-bold underline underline-offset-8 decoration-2 text-black">収支決算報告書</h1>
                  <p className="text-sm text-slate-600">作成日: {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                <div className="grid grid-cols-3 gap-8">
                  <div className="p-6 border-2 border-slate-200 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">総収入</p>
                    <p className="text-2xl font-bold">¥{totalIncome.toLocaleString()}</p>
                  </div>
                  <div className="p-6 border-2 border-slate-200 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">総支出</p>
                    <p className="text-2xl font-bold">¥{totalExpense.toLocaleString()}</p>
                  </div>
                  <div className="p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">現在の残高</p>
                    <p className="text-2xl font-bold text-indigo-600">¥{balance.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-bold border-b-2 border-slate-900 pb-2">収支明細</h2>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-xs font-bold text-slate-600">
                        <th className="py-4 px-2">日付</th>
                        <th className="py-4 px-2">項目</th>
                        <th className="py-4 px-2">区分</th>
                        <th className="py-4 px-2 text-right">金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {records.map(record => (
                        <tr key={record.id} className="text-sm">
                          <td className="py-4 px-2 font-mono">{record.date}</td>
                          <td className="py-4 px-2 font-bold">{record.description}</td>
                          <td className="py-4 px-2">
                            <span className={record.type === 'income' ? 'text-emerald-600' : 'text-orange-600'}>
                              {record.type === 'income' ? '収入' : '支出'}
                            </span>
                          </td>
                          <td className={`py-4 px-2 text-right font-bold ${record.type === 'income' ? 'text-emerald-600' : 'text-orange-600'}`}>
                            {record.type === 'income' ? '+' : '-'}¥{record.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-20 text-right space-y-2">
                  <p className="text-sm font-bold">スマートレジデンス 管理組合</p>
                  <p className="text-xs text-slate-500">理事長：____________________ (印)</p>
                  <p className="text-xs text-slate-500">会計：____________________ (印)</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Accounting;

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../AuthContext';
import { Member } from '../types';
import { Search, Phone, Car, Check, Clock, ShieldAlert, UserPlus, Trash2, X, Plus, Eye, Download, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const Members: React.FC = () => {
  const { profile, handleFirestoreError, showAlert } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newMember, setNewMember] = useState<Partial<Member>>({
    roomNumber: '',
    name: '',
    parkingNumber: '',
    phone: '',
    position: '居住者',
    paymentStatus: 'unpaid'
  });

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'members'), orderBy('roomNumber', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (err) => handleFirestoreError(err, 'get' as any, 'members', auth.currentUser));

    return () => unsubscribe();
  }, [profile]);

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isPrivileged = profile && (['manager', 'admin', 'accountant', 'asst_manager', 'asst_accountant'].includes(profile.role) || isMasterAdmin);

  const handleDownloadPDF = async () => {
    try {
      // Create a hidden container for PDF generation
      const printContainer = document.createElement('div');
      printContainer.id = `pdf-print-members`;
      printContainer.style.position = 'fixed';
      printContainer.style.left = '-9999px';
      printContainer.style.top = '0';
      printContainer.style.width = '800px';
      printContainer.style.backgroundColor = '#ffffff';
      printContainer.style.color = '#000000';
      printContainer.style.padding = '60px';
      printContainer.style.fontFamily = '"Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';
      
      const reportDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
      
      printContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-size: 24pt; font-weight: bold; text-decoration: underline; text-underline-offset: 10px;">居住者名簿</h1>
          <p style="font-size: 10pt; margin-top: 10px;">作成日: ${reportDate}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="border-bottom: 2px solid #000; background-color: #f0f0f0;">
              <th style="text-align: left; padding: 10px; border: 1px solid #000;">部屋番号</th>
              <th style="text-align: left; padding: 10px; border: 1px solid #000;">氏名</th>
              ${isPrivileged ? '<th style="text-align: left; padding: 10px; border: 1px solid #000;">役職</th>' : ''}
              ${isPrivileged ? '<th style="text-align: left; padding: 10px; border: 1px solid #000;">駐車場</th>' : ''}
              ${isPrivileged ? '<th style="text-align: left; padding: 10px; border: 1px solid #000;">電話番号</th>' : ''}
              ${isPrivileged ? '<th style="text-align: left; padding: 10px; border: 1px solid #000;">状況</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${filteredMembers.map((member: any) => `
              <tr>
                <td style="padding: 10px; border: 1px solid #000;">${member.roomNumber || '---'}</td>
                <td style="padding: 10px; border: 1px solid #000; font-weight: bold;">${member.name || '未設定'}</td>
                ${isPrivileged ? `<td style="padding: 10px; border: 1px solid #000;">${member.position || '居住者'}</td>` : ''}
                ${isPrivileged ? `<td style="padding: 10px; border: 1px solid #000;">${member.parkingNumber || '無'}</td>` : ''}
                ${isPrivileged ? `<td style="padding: 10px; border: 1px solid #000;">${member.phone || '---'}</td>` : ''}
                ${isPrivileged ? `<td style="padding: 10px; border: 1px solid #000;">${member.paymentStatus === 'paid' ? '納入済' : '未納'}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 40px; text-align: right; font-size: 9pt; color: #666;">
          スマートレジデンス 管理組合
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
        link.download = '居住者名簿.pdf';
        document.body.appendChild(link);
        link.click();
        
        // Cleanup link
        setTimeout(() => {
          if (link.parentNode) link.parentNode.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        
        setShowPreview(false);
      } finally {
        // Always remove the print container
        if (printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer);
        }
      }
    } catch (error) {
      console.error('PDF export error:', error);
      showAlert("エラー", "PDFの作成に失敗しました。ブラウザの設定や通信状況を確認してください。");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.roomNumber || !newMember.name) return;

    try {
      if (editingMember) {
        await updateDoc(doc(db, 'members', editingMember.id), {
          ...newMember,
          updatedAt: new Date().toISOString()
        });
      } else {
        const memberId = newMember.roomNumber;
        await setDoc(doc(db, 'members', memberId), {
          ...newMember,
          updatedAt: new Date().toISOString()
        });
      }
      setShowAddModal(false);
      setEditingMember(null);
      setNewMember({ roomNumber: '', name: '', parkingNumber: '', phone: '', position: '居住者', paymentStatus: 'unpaid' });
    } catch (err) {
      console.error("Save member error:", err);
    }
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setNewMember({
      roomNumber: member.roomNumber,
      name: member.name,
      parkingNumber: member.parkingNumber,
      phone: member.phone,
      position: member.position,
      paymentStatus: member.paymentStatus
    });
    setShowAddModal(true);
  };

  const handleDeleteMember = (id: string) => {
    setMemberToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    try {
      await deleteDoc(doc(db, 'members', memberToDelete));
      setMemberToDelete(null);
    } catch (err) {
      console.error("Delete member error:", err);
    }
  };

  const togglePayment = async (id: string, currentStatus: string) => {
    if (!isPrivileged) return;
    try {
      await updateDoc(doc(db, 'members', id), {
        paymentStatus: currentStatus === 'paid' ? 'unpaid' : 'paid',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Update payment status error:", err);
    }
  };

  const filteredMembers = members
    .filter(m => 
      (m.roomNumber?.includes(searchQuery)) || 
      (m.name?.includes(searchQuery)) || 
      (m.parkingNumber?.includes(searchQuery))
    )
    .sort((a, b) => {
      const roomA = a.roomNumber || '9999';
      const roomB = b.roomNumber || '9999';
      return roomA.localeCompare(roomB, undefined, { numeric: true });
    });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-slate-900">居住者名簿</h2>
          <p className="text-slate-500 mt-2 font-medium">マンションの居住者情報を確認できます。</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative group w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="部屋・氏名・駐車場番号で検索..." 
              className="w-full h-12 bg-white border border-slate-200 rounded-2xl pl-12 pr-6 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isPrivileged && (
            <div className="flex gap-2">
              <button 
                onClick={() => setShowPreview(true)}
                className="h-12 px-6 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl font-black flex items-center justify-center gap-2 border border-slate-200 transition-all active:scale-95"
              >
                <Eye size={18} /> プレビュー
              </button>
              <button 
                onClick={() => {
                  setEditingMember(null);
                  setNewMember({ roomNumber: '', name: '', parkingNumber: '', phone: '', position: '居住者', paymentStatus: 'unpaid' });
                  setShowAddModal(true);
                }}
                className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
              >
                <Plus size={18} /> 新規追加
              </button>
            </div>
          )}
        </div>
      </header>

      <div id="members-table-container" className="glass-card overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="px-8 py-6">部屋番号</th>
                <th className="px-8 py-6">氏名</th>
                {isPrivileged && <th className="px-8 py-6">役職</th>}
                {isPrivileged && <th className="px-8 py-6">駐車場</th>}
                {isPrivileged && <th className="px-8 py-6">電話番号</th>}
                {isPrivileged && <th className="px-8 py-6 text-center">状況</th>}
                {isPrivileged && <th className="px-8 py-6 text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((member: any) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <span className="inline-flex items-center justify-center px-4 py-1.5 bg-indigo-50 rounded-xl text-xs font-mono font-black text-indigo-600 border border-indigo-100">
                      {member.roomNumber || '---'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 text-sm whitespace-nowrap group-hover:text-indigo-400 transition-colors">{member.name || '未設定'}</span>
                    </div>
                  </td>
                  {isPrivileged && (
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        member.position && member.position !== '居住者'
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {member.position || '居住者'}
                      </span>
                    </td>
                  )}
                  {isPrivileged && (
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-indigo-600 text-sm font-bold whitespace-nowrap">
                        <Car size={14} className="text-indigo-400" />
                        {member.parkingNumber || '無'}
                      </div>
                    </td>
                  )}
                  {isPrivileged && (
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-slate-600 text-sm font-mono font-bold whitespace-nowrap">
                        <Phone size={14} className="text-slate-400" />
                        {member.phone || '---'}
                      </div>
                    </td>
                  )}
                  {isPrivileged && (
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <button 
                          onClick={() => togglePayment(member.id, member.paymentStatus)}
                          className={`px-5 py-2 rounded-full text-[10px] font-black tracking-tighter uppercase border transition-all flex items-center gap-2 whitespace-nowrap ${
                            member.paymentStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                            : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100'
                          }`}
                        >
                          {member.paymentStatus === 'paid' ? <><Check size={12}/> 納入済</> : <><Clock size={12}/> 未納</>}
                        </button>
                      </div>
                    </td>
                  )}
                  {isPrivileged && (
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEditMember(member)}
                          className="p-2 text-slate-600 hover:text-indigo-400 transition-colors"
                        >
                          <Plus size={18} className="rotate-45" /> {/* Using Plus rotated as an edit icon placeholder or just use a real icon if imported */}
                        </button>
                        <button 
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredMembers.map((member: any) => (
            <div key={member.id} className="p-6 space-y-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center px-3 py-1 bg-indigo-50 rounded-lg text-xs font-mono font-black text-indigo-600 border border-indigo-100">
                    {member.roomNumber || '---'}
                  </span>
                  <h4 className="font-black text-slate-900 text-base">{member.name || '未設定'}</h4>
                </div>
                {isPrivileged && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    member.position && member.position !== '居住者'
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {member.position || '居住者'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {isPrivileged && (
                  <div className="flex items-center gap-2 text-slate-600 text-xs font-bold">
                    <Car size={14} className="text-indigo-400" />
                    <span className="text-slate-500 font-medium mr-1">駐車場:</span>
                    <span className="text-indigo-600">{member.parkingNumber || '無'}</span>
                  </div>
                )}
                {isPrivileged && (
                  <div className="flex items-center gap-2 text-slate-600 text-xs font-mono font-bold">
                    <Phone size={14} className="text-slate-400" />
                    {member.phone || '---'}
                  </div>
                )}
              </div>

              {isPrivileged && (
                <div className="flex items-center justify-between pt-2">
                  <button 
                    onClick={() => togglePayment(member.id, member.paymentStatus)}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-tighter uppercase border transition-all flex items-center justify-center gap-2 ${
                      member.paymentStatus === 'paid'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : 'bg-orange-50 text-orange-600 border-orange-100'
                    }`}
                  >
                    {member.paymentStatus === 'paid' ? <><Check size={12}/> 納入済</> : <><Clock size={12}/> 未納</>}
                  </button>
                  <button 
                    onClick={() => handleDeleteMember(member.id)}
                    className="ml-4 p-2.5 text-slate-600 hover:text-rose-500 bg-slate-50 rounded-xl border border-slate-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {filteredMembers.length === 0 && (
          <div className="p-24 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Search size={24} className="text-slate-700" />
            </div>
            <p className="text-slate-500 text-sm font-bold italic">該当する居住者が見つかりませんでした。</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <UserPlus className="text-indigo-500" />
                  {editingMember ? '居住者編集' : '居住者登録'}
                </h3>
                <button onClick={() => {
                  setShowAddModal(false);
                  setEditingMember(null);
                }} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">部屋番号</label>
                    <input 
                      type="text" 
                      required 
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newMember.roomNumber}
                      onChange={(e) => setNewMember({...newMember, roomNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">駐車場番号</label>
                    <select 
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newMember.parkingNumber}
                      onChange={(e) => setNewMember({...newMember, parkingNumber: e.target.value})}
                    >
                      <option value="">無</option>
                      {Array.from({ length: 40 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num.toString()}>{num}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">氏名</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newMember.name}
                    onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">役職</label>
                  <select 
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newMember.position}
                    onChange={(e) => setNewMember({...newMember, position: e.target.value})}
                  >
                    <option value="居住者">居住者</option>
                    <option value="理事長">理事長</option>
                    <option value="副理事長">副理事長</option>
                    <option value="会計">会計</option>
                    <option value="監事">監事</option>
                    <option value="管理人">管理人</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">電話番号</label>
                  <input 
                    type="tel" 
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newMember.phone}
                    onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                  />
                </div>

                <button type="submit" className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black shadow-lg shadow-indigo-900/20 transition-all active:scale-95 mt-4">
                  {editingMember ? '更新する' : '登録する'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl">
            <motion.div 
              key="members-preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl bg-white border border-slate-200 rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Eye className="text-indigo-500" />
                  名簿プレビュー
                </h3>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
                <div id="pdf-print-members-preview" className="bg-white text-black p-12 shadow-2xl mx-auto w-full max-w-[800px] min-h-[1000px] flex flex-col font-serif">
                  <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold underline underline-offset-8">居住者名簿</h1>
                    <p className="text-[10px] mt-4">作成日: {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>

                  <table className="w-full border-collapse border border-black text-[10px]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black p-2 text-left">部屋番号</th>
                        <th className="border border-black p-2 text-left">氏名</th>
                        <th className="border border-black p-2 text-left">役職</th>
                        <th className="border border-black p-2 text-left">駐車場</th>
                        {isPrivileged && <th className="border border-black p-2 text-left">電話番号</th>}
                        {isPrivileged && <th className="border border-black p-2 text-left">状況</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((member: any) => (
                        <tr key={member.id}>
                          <td className="border border-black p-2">{member.roomNumber || '---'}</td>
                          <td className="border border-black p-2 font-bold">{member.name || '未設定'}</td>
                          <td className="border border-black p-2">{member.position || '居住者'}</td>
                          <td className="border border-black p-2">{member.parkingNumber || '無'}</td>
                          {isPrivileged && <td className="border border-black p-2">{member.phone || '---'}</td>}
                          {isPrivileged && <td className="border border-black p-2">{member.paymentStatus === 'paid' ? '納入済' : '未納'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-auto pt-10 text-right text-[8px] text-slate-500">
                    スマートレジデンス 管理組合
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={async () => {
                    setIsGenerating(true);
                    await handleDownloadPDF();
                    setIsGenerating(false);
                  }}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
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
          setMemberToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="居住者の削除"
        message="この居住者情報を削除してもよろしいですか？この操作は取り消せません。"
      />
    </div>
  );
};

export default Members;

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { MessageSquare, Send, CheckCircle2, Clock, User, Building2, ChevronRight, Search, Filter, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Inquiry {
  id: string;
  userId: string;
  userName: string;
  roomNumber: string;
  subject: string;
  status: 'open' | 'closed';
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt?: string;
  unreadByManager?: boolean;
  unreadByResident?: boolean;
}

interface InquiryMessage {
  id: string;
  inquiryId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

const Inquiries: React.FC = () => {
  const { profile, handleFirestoreError } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [isNewInquiryModalOpen, setIsNewInquiryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isManager = profile?.role === 'manager' || profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';

  useEffect(() => {
    if (!profile || !auth.currentUser) return;

    let q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
    
    if (!isManager) {
      q = query(collection(db, 'inquiries'), where('userId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInquiries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Inquiry)));
    }, (error) => {
      handleFirestoreError(error, 'list' as any, 'inquiries');
    });

    return () => unsubscribe();
  }, [profile, isManager]);

  useEffect(() => {
    if (!selectedInquiry) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `inquiries/${selectedInquiry.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InquiryMessage)));
      
      // Mark as read
      if (isManager && selectedInquiry.unreadByManager) {
        updateDoc(doc(db, 'inquiries', selectedInquiry.id), { unreadByManager: false });
      } else if (!isManager && selectedInquiry.unreadByResident) {
        updateDoc(doc(db, 'inquiries', selectedInquiry.id), { unreadByResident: false });
      }
    }, (error) => {
      handleFirestoreError(error, 'list' as any, `inquiries/${selectedInquiry.id}/messages`);
    });

    return () => unsubscribe();
  }, [selectedInquiry, isManager]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !profile || !newSubject.trim() || !newMessage.trim()) return;

    try {
      const inquiryData = {
        userId: auth.currentUser.uid,
        userName: profile.name || 'ユーザー',
        roomNumber: profile.roomNumber || '---',
        subject: newSubject,
        status: 'open',
        lastMessage: newMessage,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        unreadByManager: true,
        unreadByResident: false
      };

      const docRef = await addDoc(collection(db, 'inquiries'), inquiryData);
      
      await addDoc(collection(db, `inquiries/${docRef.id}/messages`), {
        inquiryId: docRef.id,
        senderId: auth.currentUser.uid,
        senderName: profile.name || 'ユーザー',
        content: newMessage,
        createdAt: new Date().toISOString()
      });

      await logAction('問い合わせ作成', `新しい問い合わせ「${newSubject}」を作成しました`, auth.currentUser.uid);
      
      setNewSubject('');
      setNewMessage('');
      setIsNewInquiryModalOpen(false);
      setSelectedInquiry({ id: docRef.id, ...inquiryData } as Inquiry);
    } catch (error) {
      console.error("Error creating inquiry:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !profile || !selectedInquiry || !newMessage.trim()) return;

    try {
      const messageContent = newMessage;
      setNewMessage('');

      await addDoc(collection(db, `inquiries/${selectedInquiry.id}/messages`), {
        inquiryId: selectedInquiry.id,
        senderId: auth.currentUser.uid,
        senderName: profile.name || 'ユーザー',
        content: messageContent,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'inquiries', selectedInquiry.id), {
        lastMessage: messageContent,
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unreadByManager: !isManager,
        unreadByResident: isManager
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const toggleInquiryStatus = async (inquiry: Inquiry) => {
    try {
      const newStatus = inquiry.status === 'open' ? 'closed' : 'open';
      await updateDoc(doc(db, 'inquiries', inquiry.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      if (selectedInquiry?.id === inquiry.id) {
        setSelectedInquiry({ ...selectedInquiry, status: newStatus });
      }
      await logAction('問い合わせ状態変更', `問い合わせ「${inquiry.subject}」を${newStatus === 'open' ? '再開' : '完了'}にしました`, auth.currentUser?.uid || '');
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const filteredInquiries = inquiries.filter(inq => {
    const matchesSearch = inq.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         inq.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         inq.roomNumber.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || inq.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="h-full flex gap-6">
      {/* Sidebar: Inquiry List */}
      <div className={`flex-col bg-slate-950/40 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] overflow-hidden ${selectedInquiry ? 'hidden lg:flex lg:w-96' : 'flex w-full'}`}>
        <div className="p-6 border-b border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-white flex items-center gap-3">
              <MessageSquare className="text-indigo-500" size={24} />
              問い合わせ
            </h3>
            {!isManager && (
              <button 
                onClick={() => setIsNewInquiryModalOpen(true)}
                className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20"
              >
                <Plus size={20} />
              </button>
            )}
          </div>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text"
              placeholder="検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex gap-2">
            {(['all', 'open', 'closed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500 hover:bg-slate-800'}`}
              >
                {s === 'all' ? 'すべて' : s === 'open' ? '対応中' : '完了'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          {filteredInquiries.map(inq => (
            <button
              key={inq.id}
              onClick={() => setSelectedInquiry(inq)}
              className={`w-full text-left p-4 rounded-3xl border transition-all group relative ${selectedInquiry?.id === inq.id ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-900/20' : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/60'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-[10px] font-black uppercase tracking-widest ${selectedInquiry?.id === inq.id ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {inq.roomNumber} {inq.userName}
                </span>
                <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-400 transition-colors">
                  {inq.lastMessageAt ? new Date(inq.lastMessageAt).toLocaleDateString() : ''}
                </span>
              </div>
              <h4 className={`font-bold text-sm truncate ${selectedInquiry?.id === inq.id ? 'text-white' : 'text-slate-200'}`}>
                {inq.subject}
              </h4>
              <p className={`text-xs truncate mt-1 ${selectedInquiry?.id === inq.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                {inq.lastMessage}
              </p>
              
              {((isManager && inq.unreadByManager) || (!isManager && inq.unreadByResident)) && (
                <div className="absolute top-4 right-4 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-lg shadow-rose-900/40"></div>
              )}
            </button>
          ))}
          {filteredInquiries.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-slate-600 text-sm font-bold italic">問い合わせはありません</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Chat Area */}
      <div className={`flex-1 flex flex-col bg-slate-950/40 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] overflow-hidden ${!selectedInquiry ? 'hidden lg:flex' : 'flex'}`}>
        {selectedInquiry ? (
          <>
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedInquiry(null)} className="lg:hidden w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400">
                  <ChevronRight className="rotate-180" size={20} />
                </button>
                <div>
                  <h3 className="text-lg font-black text-white">{selectedInquiry.subject}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedInquiry.roomNumber} {selectedInquiry.userName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${selectedInquiry.status === 'open' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                      {selectedInquiry.status === 'open' ? '対応中' : '完了'}
                    </span>
                  </div>
                </div>
              </div>
              {isManager && (
                <button 
                  onClick={() => toggleInquiryStatus(selectedInquiry)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedInquiry.status === 'open' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  {selectedInquiry.status === 'open' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                  {selectedInquiry.status === 'open' ? '完了にする' : '再開する'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-3xl text-sm font-medium ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'}`}>
                      {msg.content}
                    </div>
                    <div className="flex items-center gap-2 mt-2 px-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{msg.senderName}</span>
                      <span className="text-[10px] font-mono text-slate-600">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {selectedInquiry.status === 'open' ? (
              <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-800 bg-slate-950/20">
                <div className="relative flex items-center gap-4">
                  <input 
                    type="text"
                    placeholder="メッセージを入力..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl py-4 px-6 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="w-14 h-14 bg-indigo-600 text-white rounded-3xl flex items-center justify-center hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:hover:bg-indigo-600"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 border-t border-slate-800 bg-slate-900/40 text-center">
                <p className="text-xs font-bold text-slate-500 italic">この問い合わせは完了しています。メッセージを送信するには再開してください。</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center mb-6 border border-slate-800 shadow-inner">
              <MessageSquare className="text-indigo-500" size={32} />
            </div>
            <h3 className="text-xl font-black text-white mb-2">メッセージを選択してください</h3>
            <p className="text-sm text-slate-500 font-medium max-w-xs">左のリストから問い合わせを選択するか、新しい問い合わせを作成してください。</p>
          </div>
        )}
      </div>

      {/* New Inquiry Modal */}
      <AnimatePresence>
        {isNewInquiryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-black text-white">新規問い合わせ</h3>
                <button onClick={() => setIsNewInquiryModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleCreateInquiry} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">件名</label>
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="例：共用部の電球切れについて"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">内容</label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="詳細を入力してください..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20"
                >
                  送信する
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inquiries;

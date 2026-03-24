import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth, logAction } from '../AuthContext';
import { Car, Calendar as CalendarIcon, Clock, Trash2, Plus, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ParkingReservation as ParkingReservationType, ParkingSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, startOfDay, isSameDay, parseISO, isBefore } from 'date-fns';
import { ja } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';

const ParkingReservation: React.FC = () => {
  const { profile, user, handleFirestoreError, showAlert } = useAuth();
  const [reservations, setReservations] = useState<ParkingReservationType[]>([]);
  const [settings, setSettings] = useState<ParkingSettings>({ isPublic: false });
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [resToDelete, setResToDelete] = useState<string | null>(null);
  
  const [newRes, setNewRes] = useState({
    spaceNumber: 7,
    startTime: '09:00',
    endTime: '18:00',
    carNumber: ''
  });

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin' || isMasterAdmin;

  useEffect(() => {
    // Fetch settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'parking'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as ParkingSettings);
      }
    });

    // Fetch reservations for the next 14 days to show availability
    const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const endStr = format(addDays(startOfDay(new Date()), 14), 'yyyy-MM-dd');

    const q = query(
      collection(db, 'parking_reservations'),
      where('date', '>=', todayStr),
      where('date', '<=', endStr)
    );
    
    const unsubRes = onSnapshot(q, (snap) => {
      setReservations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParkingReservationType)));
    }, (err) => handleFirestoreError(err, 'list' as any, 'parking_reservations'));

    return () => {
      unsubSettings();
      unsubRes();
    };
  }, []); // Remove selectedDate from dependencies to avoid re-subscribing

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

    // Check for overlaps
    const overlap = reservations.find(r => 
      r.date === selectedDateStr &&
      r.spaceNumber === newRes.spaceNumber &&
      ((newRes.startTime >= r.startTime && newRes.startTime < r.endTime) ||
       (newRes.endTime > r.startTime && newRes.endTime <= r.endTime) ||
       (newRes.startTime <= r.startTime && newRes.endTime >= r.endTime))
    );

    if (overlap) {
      showAlert("予約エラー", "選択した時間帯は既に予約されています。");
      return;
    }

    if (newRes.startTime >= newRes.endTime) {
      showAlert("予約エラー", "終了時間は開始時間より後に設定してください。");
      return;
    }

    try {
      await addDoc(collection(db, 'parking_reservations'), {
        spaceNumber: newRes.spaceNumber,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: newRes.startTime,
        endTime: newRes.endTime,
        userId: user.uid,
        userName: profile.name || '不明',
        roomNumber: profile.roomNumber || '管理者',
        carNumber: newRes.carNumber,
        createdAt: new Date().toISOString()
      });

      await logAction('駐車場予約', `${profile.roomNumber || '管理者'}が駐車場${newRes.spaceNumber}を予約しました（${format(selectedDate, 'MM/dd')} ${newRes.startTime}-${newRes.endTime}、車番: ${newRes.carNumber}）`, user.uid);
      
      setIsModalOpen(false);
      setNewRes({ spaceNumber: 7, startTime: '09:00', endTime: '18:00', carNumber: '' });
    } catch (error) {
      handleFirestoreError(error, 'create' as any, 'parking_reservations');
    }
  };

  const handleDelete = (id: string) => {
    setResToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!resToDelete || !user) return;
    try {
      const res = reservations.find(r => r.id === resToDelete);
      await deleteDoc(doc(db, 'parking_reservations', resToDelete));
      if (res) {
        await logAction('駐車場予約取消', `${profile?.roomNumber || '管理者'}が駐車場予約を取り消しました（${res.date} ${res.startTime}-${res.endTime}）`, user.uid);
      }
      setResToDelete(null);
      setIsConfirmOpen(false);
    } catch (error) {
      handleFirestoreError(error, 'delete' as any, 'parking_reservations');
    }
  };

  const togglePublic = async () => {
    if (!isManager) return;
    try {
      await setDoc(doc(db, 'settings', 'parking'), { isPublic: !settings.isPublic });
      await logAction('設定変更', `駐車場予約の公開設定を${!settings.isPublic ? '公開' : '非公開'}に変更しました`, user?.uid || '');
    } catch (error) {
      handleFirestoreError(error, 'update' as any, 'settings/parking');
    }
  };

  if (!settings.isPublic && !isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
          <Car size={40} />
        </div>
        <div className="text-center max-w-md px-6">
          <h3 className="text-2xl font-black text-white">駐車場予約は現在停止中です</h3>
          <p className="text-slate-500 mt-4 font-medium leading-relaxed">
            管理組合による設定により、現在はシステムからの予約を受け付けておりません。<br />
            詳細については<span className="text-indigo-400 font-bold">「お知らせ」</span>や掲示板等をご確認いただくか、管理事務所までお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">来客用駐車場予約</h2>
          <p className="text-slate-500 mt-2 font-medium">来客用の駐車場（No.7〜10）の予約管理を行います。</p>
        </div>
        <div className="flex items-center gap-4">
          {isManager && (
            <button 
              onClick={togglePublic}
              className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${
                settings.isPublic 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500/20'
              }`}
            >
              {settings.isPublic ? '公開中' : '非公開中'}
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-2 font-black text-sm"
          >
            <Plus size={20} />
            <span>予約する</span>
          </button>
        </div>
      </header>
      
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
          <AlertCircle size={24} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-amber-500">ご利用上の注意</h3>
          <ul className="text-sm text-slate-400 font-medium space-y-1 list-disc list-inside">
            <li>予約は当日を含む14日先まで可能です。</li>
            <li>1回の予約につき、最大24時間までご利用いただけます。</li>
            <li>車両番号（ナンバープレート）は必ず正しく入力してください。未登録車両は不法駐車として扱われる場合があります。</li>
            <li>予約時間を過ぎてのご利用は、他の方の迷惑となりますので固くお断りいたします。</li>
            <li>駐車場内での事故・盗難等について、管理組合は一切の責任を負いません。</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Date Selector */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card p-6">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <CalendarIcon size={16} />
              日付選択
            </h3>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((offset) => {
                const date = addDays(startOfDay(new Date()), offset);
                const dateStr = format(date, 'yyyy-MM-dd');
                const isSelected = isSameDay(date, selectedDate);
                
                // Calculate availability
                const dayReservations = reservations.filter(r => r.date === dateStr);
                const reservedSpaces = new Set(dayReservations.map(r => r.spaceNumber)).size;
                const isFull = reservedSpaces >= 4;

                return (
                  <button
                    key={offset}
                    onClick={() => setSelectedDate(date)}
                    className={`w-full p-4 rounded-2xl text-left transition-all border flex items-center justify-between group ${
                      isSelected 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                          {format(date, 'EEEE', { locale: ja })}
                        </p>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          isSelected 
                          ? 'bg-white/20 text-white' 
                          : isFull 
                            ? 'bg-rose-500/10 text-rose-500' 
                            : 'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {isFull ? '満車' : `${4 - reservedSpaces}空き`}
                        </span>
                      </div>
                      <p className="font-black">{format(date, 'M月 d日')}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Spaces Grid */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[7, 8, 9, 10].map((spaceNum) => {
              const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
              const spaceReservations = reservations
                .filter(r => r.spaceNumber === spaceNum && r.date === selectedDateStr)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

              return (
                <div key={spaceNum} className="glass-card overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <h3 className="text-lg font-black text-white flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                        <Car size={20} />
                      </div>
                      駐車場 {spaceNum}
                    </h3>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {spaceReservations.length}件の予約
                    </span>
                  </div>
                  <div className="p-6 space-y-4 flex-1">
                    {spaceReservations.map((res) => (
                      <div key={res.id} className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 group hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-indigo-400">
                            <Clock size={14} />
                            <span className="text-xs font-black tracking-widest">{res.startTime} - {res.endTime}</span>
                          </div>
                          {(isManager || res.userId === user?.uid) && (
                            <button 
                              onClick={() => handleDelete(res.id)}
                              className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-black text-white">{res.userName}</p>
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">車番: {res.carNumber}</p>
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{res.roomNumber}</p>
                        </div>
                      </div>
                    ))}
                    {spaceReservations.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center py-10 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-700">
                          <Car size={24} />
                        </div>
                        <p className="text-xs font-bold text-slate-600 italic">予約はありません</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reservation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-black text-white">駐車場予約</h3>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="mb-8 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-4">
                <CalendarIcon className="text-indigo-500" size={24} />
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">予約日</p>
                  <p className="font-black text-white">{format(selectedDate, 'yyyy年 M月 d日 (EEEE)', { locale: ja })}</p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">駐車場番号</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setNewRes({ ...newRes, spaceNumber: num })}
                        className={`py-3 rounded-xl font-black text-sm transition-all border ${
                          newRes.spaceNumber === num 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">開始時間</label>
                    <input
                      type="time"
                      value={newRes.startTime}
                      onChange={(e) => setNewRes({ ...newRes, startTime: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">終了時間</label>
                    <input
                      type="time"
                      value={newRes.endTime}
                      onChange={(e) => setNewRes({ ...newRes, endTime: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">車両番号（必須）</label>
                  <input
                    type="text"
                    value={newRes.carNumber}
                    onChange={(e) => setNewRes({ ...newRes, carNumber: e.target.value })}
                    placeholder="例: 品川 500 あ 12-34"
                    className="input-field"
                    required
                  />
                  <p className="text-[9px] text-slate-500 ml-4">※ナンバープレートの情報を正確に入力してください。</p>
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
                  >予約を確定する</button>
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
          setResToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="予約の取消"
        message="この駐車場の予約を取り消しますか？"
        confirmText="取り消す"
        variant="danger"
      />
    </div>
  );
};

export default ParkingReservation;

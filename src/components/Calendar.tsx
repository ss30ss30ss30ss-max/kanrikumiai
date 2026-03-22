import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../AuthContext';
import { Calendar as CalendarIcon, Plus, Trash2, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { CalendarEvent } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';

const Calendar: React.FC = () => {
  const { profile, handleFirestoreError } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const canEdit = profile?.role === 'manager' || profile?.role === 'asst_manager' || isMasterAdmin;

  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(collection(db, 'calendar_events'), (snap) => {
      setEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent)));
    }, (err) => {
      handleFirestoreError(err, 'list' as any, 'calendar_events');
    });
    return unsub;
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !selectedDate) return;

    const start = new Date(selectedDate);
    const [sH, sM] = startTime.split(':');
    start.setHours(parseInt(sH), parseInt(sM));

    const end = new Date(selectedDate);
    const [eH, eM] = endTime.split(':');
    end.setHours(parseInt(eH), parseInt(eM));

    try {
      await addDoc(collection(db, 'calendar_events'), {
        title,
        description,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        authorUid: auth.currentUser?.uid,
      });
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    setEventToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    try {
      await deleteDoc(doc(db, 'calendar_events', eventToDelete));
      setEventToDelete(null);
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartTime('10:00');
    setEndTime('11:00');
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">カレンダー</h2>
          <p className="text-slate-500 mt-2 font-medium">マンションの共用施設の予約やイベントを確認できます。</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-xl">
          <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><ChevronLeft size={20} /></button>
          <span className="px-4 font-black text-white text-sm tracking-tighter">{format(currentMonth, 'yyyy年 MM月', { locale: ja })}</span>
          <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><ChevronRight size={20} /></button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 glass-card p-8">
          <div className="grid grid-cols-7 mb-6">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-black uppercase tracking-widest mb-2 ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-indigo-400' : 'text-slate-500'}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}
            {days.map((day) => {
              const dayEvents = events.filter(e => isSameDay(new Date(e.startDate), day));
              return (
                <button
                  key={day.toString()}
                  onClick={() => {
                    setSelectedDate(day);
                    if (canEdit) setIsModalOpen(true);
                  }}
                  className={`aspect-square rounded-[1.5rem] border transition-all flex flex-col p-3 relative group ${
                    isToday(day) 
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-900/20' 
                    : 'border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/50'
                  }`}
                >
                  <span className={`text-sm font-black ${isToday(day) ? 'text-indigo-400' : 'text-slate-300'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-auto flex gap-1 flex-wrap">
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id} className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-sm shadow-indigo-900" />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[8px] text-slate-500 font-black">+{dayEvents.length - 3}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Event List for Selected Month */}
        <div className="glass-card overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-800">
            <h3 className="text-xl font-black flex items-center gap-3 text-white">
              <Clock size={24} className="text-indigo-500" />
              今月の予定
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-8 space-y-8 custom-scrollbar">
            {events
              .filter(e => format(new Date(e.startDate), 'yyyy-MM') === format(currentMonth, 'yyyy-MM'))
              .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
              .map(ev => (
                <div key={ev.id} className="relative pl-8 border-l-2 border-slate-800 group">
                  <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-900 group-hover:scale-150 transition-all" />
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                      {format(new Date(ev.startDate), 'MM/dd HH:mm', { locale: ja })}
                    </span>
                    {canEdit && (
                      <button onClick={() => handleDelete(ev.id)} className="p-2 text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <h4 className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors leading-tight">{ev.title}</h4>
                  <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">{ev.description}</p>
                </div>
              ))}
            {events.filter(e => format(new Date(e.startDate), 'yyyy-MM') === format(currentMonth, 'yyyy-MM')).length === 0 && (
              <div className="text-center text-slate-600 py-20 font-bold italic">
                今月の予定はありません。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-white">
                  {selectedDate && format(selectedDate, 'MM月dd日')} の予定
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">イベント名</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input-field"
                    placeholder="例：理事会、清掃活動"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">開始時間</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">終了時間</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">詳細</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input-field h-32 resize-none leading-relaxed"
                    placeholder="場所や持ち物など"
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
                  >保存する</button>
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
          setEventToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="予定の削除"
        message="この予定を削除してもよろしいですか？この操作は取り消せません。"
      />
    </div>
  );
};

export default Calendar;

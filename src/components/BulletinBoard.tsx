import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { BulletinPost, BulletinComment } from '../types';
import { MessageSquare, Plus, Trash2, Send, User, Clock, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

const BulletinBoard: React.FC = () => {
  const { profile, user, handleFirestoreError } = useAuth();
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});

  const isMasterAdmin = profile?.email === 'admin@smart-management.local' || profile?.email === 'ss30ss30ss30ss@gmail.com';
  const isManager = profile?.role === 'manager' || profile?.role === 'asst_manager' || profile?.role === 'accountant' || profile?.role === 'asst_accountant' || isMasterAdmin;

  useEffect(() => {
    const q = query(collection(db, 'bulletin_posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BulletinPost));
      setPosts(fetchedPosts);
    }, (error) => {
      handleFirestoreError(error, 'list' as any, 'bulletin_posts');
    });
    return () => unsubscribe();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !newPost.title.trim() || !newPost.content.trim()) return;

    try {
      await addDoc(collection(db, 'bulletin_posts'), {
        title: newPost.title,
        content: newPost.content,
        authorUid: user.uid,
        authorName: profile.name || '居住者',
        authorRoom: profile.roomNumber || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        comments: []
      });
      setNewPost({ title: '', content: '' });
      setIsAddingPost(false);
    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('この投稿を削除しますか？')) return;
    try {
      await deleteDoc(doc(db, 'bulletin_posts', postId));
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleAddComment = async (postId: string) => {
    const commentText = commentInputs[postId];
    if (!user || !profile || !commentText?.trim()) return;

    const newComment: BulletinComment = {
      id: Math.random().toString(36).substr(2, 9),
      content: commentText,
      authorUid: user.uid,
      authorName: profile.name || '居住者',
      createdAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'bulletin_posts', postId), {
        comments: arrayUnion(newComment),
        updatedAt: new Date().toISOString()
      });
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">掲示板</h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Community Board</p>
        </div>
        <button
          onClick={() => setIsAddingPost(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-900/20"
        >
          <Plus size={18} />
          新規投稿
        </button>
      </div>

      <AnimatePresence>
        {isAddingPost && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl"
          >
            <form onSubmit={handleCreatePost} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">タイトル</label>
                <input
                  type="text"
                  required
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                  placeholder="投稿のタイトルを入力..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">内容</label>
                <textarea
                  required
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all min-h-[150px]"
                  placeholder="内容を入力してください..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingPost(false)}
                  className="px-6 py-3 text-slate-400 font-bold text-sm hover:text-white transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-900/20"
                >
                  投稿する
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6">
        {posts.map((post) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-950 border border-slate-800/60 rounded-[2.5rem] overflow-hidden hover:border-slate-700 transition-all group"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-indigo-400 border border-slate-800">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">{post.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-bold text-indigo-400">{post.authorName} {post.authorRoom && `(${post.authorRoom}号室)`}</span>
                      <span className="text-slate-600">•</span>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {format(new Date(post.createdAt), 'yyyy/MM/dd HH:mm', { locale: ja })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {(user?.uid === post.authorUid || isManager) && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="p-3 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="text-slate-300 leading-relaxed whitespace-pre-wrap mb-8">
                {post.content}
              </div>

              <div className="border-t border-slate-800/60 pt-8 space-y-6">
                <div className="flex items-center gap-2 text-slate-500 mb-4">
                  <MessageCircle size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">コメント ({post.comments?.length || 0})</span>
                </div>

                <div className="space-y-4">
                  {post.comments?.map((comment) => (
                    <div key={comment.id} className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/40">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-indigo-400">{comment.authorName}</span>
                        <span className="text-[9px] text-slate-600 font-bold uppercase">
                          {format(new Date(comment.createdAt), 'MM/dd HH:mm', { locale: ja })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{comment.content}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6">
                  <input
                    type="text"
                    value={commentInputs[post.id] || ''}
                    onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                    placeholder="コメントを入力..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                  <button
                    onClick={() => handleAddComment(post.id)}
                    disabled={!commentInputs[post.id]?.trim()}
                    className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-500 disabled:opacity-50 transition-all"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BulletinBoard;

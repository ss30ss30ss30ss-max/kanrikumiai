import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader2, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIConcierge: React.FC = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'こんにちは！マンションAIコンシェルジュです。管理規約や設備、お困りごとについて何でもお聞きください。' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-ai-concierge', handleOpen);
    return () => window.removeEventListener('open-ai-concierge', handleOpen);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.concat({ role: 'user', content: userMessage }).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction: `あなたはマンション管理アプリ「スマート管理」のAIコンシェルジュです。
このアプリの機能（名簿確認、会計、お知らせ、カレンダー、配布文書作成など）や、マンション生活の一般的なルールに関する質問にのみ答えてください。
それ以外の一般的な質問や、アプリに関係のない話題（世間話、専門外の知識、個人的な相談など）については、回答を控え、「申し訳ありませんが、その質問にはお答えできません。マンション管理に関する具体的な内容については、管理事務室へ直接お問い合わせいただくか、管理者へメッセージを送信してご確認ください」と案内してください。
回答は簡潔かつ丁寧な日本語で行ってください。`,
        }
      });

      const assistantMessage = response.text;
      if (assistantMessage) {
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      }
    } catch (error) {
      console.error("AI Concierge error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: '申し訳ありません。エラーが発生しました。しばらくしてから再度お試しください。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] md:inset-auto md:bottom-24 md:right-6 md:w-[400px] md:h-[calc(100vh-120px)] md:max-h-[600px] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              className="w-full h-full bg-slate-900 border border-slate-800 md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
            >
              {/* Header */}
              <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white tracking-tight">AIコンシェルジュ</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Online</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-500 hover:bg-slate-800 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {messages.map((message, index) => (
                  <div 
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user' ? 'bg-slate-800' : 'bg-indigo-600/20 text-indigo-400'
                      }`}>
                        {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                      </div>
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        message.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-900/20' 
                        : 'bg-slate-800/50 text-slate-200 rounded-tl-none border border-slate-700/50'
                      }`}>
                        <div className="markdown-body prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[85%]">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                        <Bot size={16} />
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 rounded-tl-none">
                        <Loader2 size={16} className="text-indigo-400 animate-spin" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-6 bg-slate-950 border-t border-slate-800">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="メッセージを入力..."
                    className="w-full h-14 bg-slate-900 border border-slate-800 rounded-2xl pl-6 pr-14 text-sm text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <p className="text-[9px] text-slate-600 font-bold text-center mt-3 uppercase tracking-widest">
                  Powered by Gemini AI
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIConcierge;

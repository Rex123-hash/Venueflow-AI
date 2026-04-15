import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBaseUrl } from '../lib/runtime';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  isStreaming?: boolean;
}

interface ChatBotProps {
  fanId?: string;
  className?: string;
}

const ChatBot: React.FC<ChatBotProps> = ({ fanId, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'bot', text: 'Hi! I\'m FlowBot. Ask me about gate wait times, food stalls, or your seat location. 🏏' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWaiting]);

  // Listen for emergency global event
  useEffect(() => {
    const handleEmergency = (e: CustomEvent) => {
      const { announcement, message, active } = e.detail;
      if (active) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'bot',
          text: message || announcement || 'URGENT: Emergency declared. Please follow the neon green arrows to the nearest exit immediately.'
        }]);
        setIsOpen(true);
      }
    };
    
    window.addEventListener('venueflow-emergency', handleEmergency as EventListener);
    return () => window.removeEventListener('venueflow-emergency', handleEmergency as EventListener);
  }, []);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isWaiting) return;

    const userText = inputValue;
    const userMsgId = Date.now().toString();
    const botMsgId = (Date.now() + 1).toString();

    setMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userText }]);
    setInputValue('');
    setIsWaiting(true);

    // Create empty streaming message
    setMessages(prev => [...prev, { id: botMsgId, sender: 'bot', text: '', isStreaming: true }]);

    try {
      const API_URL = getApiBaseUrl();
      const params = new URLSearchParams({ message: userText });
      if (fanId) params.append('fan_id', fanId);

      const response = await fetch(`${API_URL}/ai/chat/stream?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('venueflow-token')}`
        }
      });

      if (!response.body) throw new Error('No readable stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let botText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // chunk is SSE formatted: "data: {"token":"hello"}\n\n"
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.token) {
                botText += data.token;
                // Update streaming message
                setMessages(prev => prev.map(m => 
                  m.id === botMsgId ? { ...m, text: botText } : m
                ));
              }
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      // Finalize message
      setMessages(prev => prev.map(m => 
        m.id === botMsgId ? { ...m, text: botText, isStreaming: false } : m
      ));
      
    } catch (err) {
      console.error('Chat error:', err);
      // Fallback message
      setMessages(prev => prev.map(m => 
        m.id === botMsgId ? { ...m, text: "I'm having trouble connecting right now. Try again shortly!", isStreaming: false } : m
      ));
    } finally {
      setIsWaiting(false);
    }
  };

  return (
    <div className={`fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 ${className}`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="card mb-4 w-80 sm:w-96 h-[400px] flex flex-col shadow-2xl border-border overflow-hidden"
          >
            {/* Header */}
            <div className="p-3 border-b border-border bg-gradient-to-r from-bg-secondary to-bg-card flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold">
                  FB
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-tight text-text-primary">FlowBot</h3>
                  <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                    Online
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close Chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg-primary">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'bot' && (
                    <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex-shrink-0 flex items-center justify-center text-xs font-bold mr-2 mt-1">
                      FB
                    </div>
                  )}
                  <div 
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      msg.sender === 'user' 
                        ? 'bg-accent text-white rounded-tr-sm' 
                        : 'bg-bg-secondary text-text-primary border border-border rounded-tl-sm'
                    }`}
                  >
                    <span className={msg.isStreaming ? 'typing-cursor' : ''}>
                      {msg.text}
                    </span>
                  </div>
                </div>
              ))}
              {isWaiting && !messages.find(m => m.isStreaming) && (
                <div className="flex justify-start">
                   <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex-shrink-0 flex items-center justify-center text-xs font-bold mr-2 mt-1">
                      FB
                    </div>
                  <div className="bg-bg-secondary border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-sm flex items-center gap-1">
                    <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 bg-text-secondary rounded-full" />
                    <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-text-secondary rounded-full" />
                    <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-text-secondary rounded-full" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-border bg-bg-card">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask about queues, food..."
                  className="flex-1 input-field py-2 px-3 text-sm rounded-full"
                  disabled={isWaiting}
                />
                <button 
                  type="submit" 
                  disabled={!inputValue.trim() || isWaiting}
                  className="w-9 h-9 rounded-full bg-accent hover:bg-accent-light text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Send"
                >
                  <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent2 shadow-glow-indigo text-white flex items-center justify-center hover:scale-105 transition-transform group"
            aria-label="Open Chat"
          >
            <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {/* Unread badge mock */}
            <span className="absolute top-0 right-0 w-3 h-3 bg-danger border-2 border-bg-primary rounded-full"></span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatBot;

'use client';

import { useState, useEffect, useCallback } from 'react';

type MessageType = 'success' | 'error' | 'warning' | 'info';

interface ConfirmMessage {
  id: number;
  type: MessageType;
  text: string;
  subtext?: string;
}

let globalShowMessage: ((type: MessageType, text: string, subtext?: string) => void) | null = null;

export function showConfirmMessage(type: MessageType, text: string, subtext?: string) {
  if (globalShowMessage) globalShowMessage(type, text, subtext);
}

const TYPE_CONFIG: Record<MessageType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-white',
    border: 'border-[#16A34A]',
    icon: (
      <svg className="w-7 h-7 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    bg: 'bg-white',
    border: 'border-[#DC2626]',
    icon: (
      <svg className="w-7 h-7 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-white',
    border: 'border-[#D97706]',
    icon: (
      <svg className="w-7 h-7 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  info: {
    bg: 'bg-white',
    border: 'border-[#3258CA]',
    icon: (
      <svg className="w-7 h-7 text-[#3258CA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export default function ConfirmCenterMessage() {
  const [messages, setMessages] = useState<ConfirmMessage[]>([]);
  const [counter, setCounter] = useState(0);

  const addMessage = useCallback((type: MessageType, text: string, subtext?: string) => {
    setCounter((prev) => {
      const id = prev + 1;
      setMessages((msgs) => [...msgs, { id, type, text, subtext }]);
      setTimeout(() => {
        setMessages((msgs) => msgs.filter((m) => m.id !== id));
      }, 3500);
      return id;
    });
  }, []);

  useEffect(() => {
    globalShowMessage = addMessage;
    return () => { globalShowMessage = null; };
  }, [addMessage]);

  if (messages.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 pointer-events-auto">
        {messages.map((msg) => {
          const cfg = TYPE_CONFIG[msg.type];
          return (
            <div
              key={msg.id}
              className={`${cfg.bg} border-l-4 ${cfg.border} rounded-lg shadow-lg px-6 py-4 flex items-center gap-4 min-w-[320px] max-w-[480px] animate-fadeIn`}
              style={{ animation: 'fadeIn 0.2s ease-in' }}
            >
              {cfg.icon}
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-main">{msg.text}</p>
                {msg.subtext && <p className="text-xs text-text-sec mt-0.5">{msg.subtext}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

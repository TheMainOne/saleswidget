import React, { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
interface Message {
  id: number;
  type: 'ai' | 'user';
  content: string;
  showButton?: boolean;
}
const AnimatedChatDemo = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [placeholderText, setPlaceholderText] = useState('Type your message...');
  const [isTypingPlaceholder, setIsTypingPlaceholder] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const script: Message[] = [{
    id: 1,
    type: 'ai',
    content: "Hi! I'm your AI advisor. I can help with pricing, product bundles, demos, and any questions about our services. What would you like to know?"
  }, {
    id: 2,
    type: 'user',
    content: 'Will it work if most of my visitors are on mobile?'
  }, {
    id: 3,
    type: 'ai',
    content: 'Yes — the widget is fully responsive and optimized for mobile.'
  }, {
    id: 4,
    type: 'user',
    content: 'Can it answer questions in different languages?'
  }, {
    id: 5,
    type: 'ai',
    content: 'It supports multilingual responses out of the box.'
  }, {
    id: 6,
    type: 'user',
    content: "What happens if the AI doesn't know the answer?"
  }, {
    id: 7,
    type: 'ai',
    content: 'It can route the chat to your team or collect the lead for follow-up.'
  }, {
    id: 8,
    type: 'user',
    content: 'Does it show where the info comes from?'
  }, {
    id: 9,
    type: 'ai',
    content: 'Yes, every answer includes source citations for transparency.'
  }, {
    id: 10,
    type: 'user',
    content: 'Can I try it without talking to sales first?'
  }, {
    id: 11,
    type: 'ai',
    content: 'Absolutely — just start a free trial, no credit card needed.',
    showButton: true
  }];
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };
  const typeText = (text: string, callback: () => void) => {
    setIsTypingPlaceholder(true);
    setPlaceholderText('');
    let i = 0;
    const interval = setInterval(() => {
      setPlaceholderText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setTimeout(() => {
          setIsTypingPlaceholder(false);
          setPlaceholderText('Type your message...');
          callback();
        }, 200);
      }
    }, 30);
  };
  useEffect(() => {
    if (currentMessageIndex >= script.length) {
      // Reset after a pause
      const resetTimeout = setTimeout(() => {
        setMessages([]);
        setCurrentMessageIndex(0);
      }, 3000);
      return () => clearTimeout(resetTimeout);
    }
    const showMessage = () => {
      const currentMessage = script[currentMessageIndex];
      if (currentMessage.type === 'user') {
        // Type user question in placeholder before showing it
        typeText(currentMessage.content, () => {
          setMessages(prev => [...prev, currentMessage]);
          setCurrentMessageIndex(prev => prev + 1);
          setTimeout(scrollToBottom, 100);
        });
      } else {
        setIsTyping(true);

        // Show typing indicator for AI messages
        const typingTimeout = setTimeout(() => {
          setMessages(prev => [...prev, currentMessage]);
          setIsTyping(false);
          setCurrentMessageIndex(prev => prev + 1);

          // Scroll to bottom after message appears
          setTimeout(scrollToBottom, 100);
        }, 1500);
        return typingTimeout;
      }
    };
    const timeout = setTimeout(showMessage, currentMessageIndex === 0 ? 1000 : 2000);
    return () => clearTimeout(timeout);
  }, [currentMessageIndex]);
  return <div className="relative w-full h-[420px] sm:h-[500px] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
      {/* Chat Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Advisor</h3>
            <p className="text-xs text-gray-400">Online now</p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 h-[260px] sm:h-[340px] p-3 sm:p-4">
        <div className="space-y-4">
          {messages.map(message => <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.type === 'user' ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white' : 'bg-gray-800 text-gray-100 border border-gray-700'}`}>
                <p className="text-sm leading-relaxed">{message.content}</p>
                {message.showButton && <Button size="sm" className="mt-3 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold border-0">
                    Start Free Trial
                  </Button>}
              </div>
            </div>)}
          
          {/* Typing Indicator */}
          {isTyping && <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 animate-fade-in">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{
                animationDelay: '0s'
              }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{
                animationDelay: '0.1s'
              }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{
                animationDelay: '0.2s'
              }} />
                </div>
              </div>
            </div>}
        </div>
      </ScrollArea>

      {/* Chat Input (decorative) */}
      <div className="border-t border-gray-700 p-3 bg-gray-800">
        <div className="flex items-center gap-3 bg-gray-900 rounded-xl border border-gray-600 p-2">
          <div className="flex-1 px-3 py-2">
            <span className={`text-sm ${isTypingPlaceholder ? 'text-white' : 'text-gray-400'}`}>{placeholderText}</span>
          </div>
          <button className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center hover:from-purple-700 hover:to-blue-700 transition-all">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>;
};
export default AnimatedChatDemo;

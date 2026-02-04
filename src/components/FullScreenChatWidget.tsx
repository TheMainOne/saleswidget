import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, MessageCircle, RotateCcw } from 'lucide-react';
import { sendAiwChat } from '@/lib/aiw-chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ClientSettings {
  widget_title: string;
  welcome_message: string;
  primary_color: string;
  background_color: string;
  text_color: string;
  border_color: string;
  logo_url?: string;
}

interface FullScreenChatWidgetProps {
  clientId: string;
  siteId?: string;
  clientSettings: ClientSettings;
}

const STORAGE_KEY_SESSION = 'chat_session_id';
const STORAGE_KEY_TOKEN = 'chat_session_token';
const STORAGE_KEY_MESSAGES = 'chat_session_messages';
const storage = sessionStorage;

const FullScreenChatWidget: React.FC<FullScreenChatWidgetProps> = ({ clientId, siteId, clientSettings }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: clientSettings.welcome_message || 'Hi! How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);
  };

  // Load chat history on component mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const savedSessionId = storage.getItem(STORAGE_KEY_SESSION);
        const savedSessionToken = storage.getItem(STORAGE_KEY_TOKEN);
        const savedMessages = storage.getItem(STORAGE_KEY_MESSAGES);

        if (savedSessionId) {
          setSessionId(savedSessionId);
        }
        if (savedSessionToken) {
          setSessionToken(savedSessionToken);
        }

        if (savedMessages) {
          const parsedMessages = JSON.parse(savedMessages);
          if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
            setMessages(
              parsedMessages.map((message: any) => ({
                ...message,
                timestamp: new Date(message.timestamp),
              })),
            );
          }
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, []);

  useEffect(() => {
    if (!isLoadingHistory && sessionId) {
      storage.setItem(STORAGE_KEY_SESSION, sessionId);
    }
    if (!isLoadingHistory && sessionToken) {
      storage.setItem(STORAGE_KEY_TOKEN, sessionToken);
    }
    if (!isLoadingHistory) {
      storage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    }
  }, [messages, sessionId, sessionToken, isLoadingHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    const trimmedInput = inputValue.trim();
    
    if (!trimmedInput) {
      setInputError('Message cannot be empty');
      return;
    }
    
    if (trimmedInput.length > 1000) {
      setInputError('Message must be less than 1000 characters');
      return;
    }
    
    if (isLoading) return;
    
    setInputError('');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const conversation = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const data = await sendAiwChat({
        messages: conversation,
        siteId: siteId || clientId || 'widget',
        clientId,
        sessionId,
        meta: {
          source: 'fullscreen-chat-widget',
        },
      });

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      if (data.sessionToken && !sessionToken) {
        setSessionToken(data.sessionToken);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Sorry, I could not generate a response.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: clientSettings.welcome_message || 'Hi! How can I help you today?',
        timestamp: new Date()
      }
    ]);
    setSessionId(null);
    setSessionToken(null);
    storage.removeItem(STORAGE_KEY_SESSION);
    storage.removeItem(STORAGE_KEY_TOKEN);
    storage.removeItem(STORAGE_KEY_MESSAGES);
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  return (
    <div 
      className="flex h-[70vh] min-h-[480px] w-full flex-col rounded-lg sm:h-[900px]"
      style={{ 
        backgroundColor: clientSettings.background_color,
        border: `2px solid ${clientSettings.border_color}`,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b"
        style={{ 
          borderColor: `${clientSettings.border_color}40`,
          backgroundColor: clientSettings.background_color
        }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="flex items-center justify-center w-10 h-10 rounded-lg overflow-hidden"
          >
            {clientSettings.logo_url ? (
              <img 
                src={clientSettings.logo_url} 
                alt="Logo" 
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <MessageCircle className="w-5 h-5" style={{ color: '#ffffff' }} />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold sm:text-lg" style={{ color: clientSettings.text_color }}>
              {clientSettings.widget_title}
            </h3>
          </div>
        </div>
        <Button
          onClick={resetChat}
          className="flex items-center gap-2 px-2 sm:px-3"
          style={{
            backgroundColor: 'transparent',
            color: clientSettings.text_color,
            border: `1px solid ${clientSettings.border_color}40`
          }}
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
        <div className="max-w-4xl mx-auto py-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-6 ${
                message.role === 'user' 
                  ? 'flex justify-end' 
                  : 'flex justify-start'
              }`}
            >
              <div className={`flex max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
                {/* Avatar */}
                <div 
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
                  style={{
                    backgroundColor: message.role === 'user' ? clientSettings.primary_color : 'transparent'
                  }}
                >
                  {message.role === 'user' ? (
                    <span className="text-sm font-medium text-white">U</span>
                  ) : (
                    clientSettings.logo_url ? (
                      <img 
                        src={clientSettings.logo_url} 
                        alt="AI" 
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <MessageCircle className="w-4 h-4 text-white" />
                    )
                  )}
                </div>

                {/* Message Content */}
                <div 
                  className="rounded-2xl px-4 py-3"
                  style={{
                    backgroundColor: message.role === 'user' ? clientSettings.primary_color : '#1a1a1a',
                    color: '#ffffff'
                  }}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <span className="text-xs mt-1 block opacity-70">
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="mb-6 flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div 
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
                >
                  {clientSettings.logo_url ? (
                    <img 
                      src={clientSettings.logo_url} 
                      alt="AI" 
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <MessageCircle className="w-4 h-4 text-white" />
                  )}
                </div>
                <div 
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}
                >
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">AI is typing...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div 
        className="border-t p-4"
        style={{ 
          borderColor: `${clientSettings.border_color}40`,
          backgroundColor: clientSettings.background_color
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div 
            className="relative flex items-end gap-3 rounded-xl p-3"
            style={{ 
              backgroundColor: '#1a1a1a',
              border: `1px solid ${clientSettings.border_color}40`
            }}
          >
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (inputError) setInputError('');
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className="min-h-[44px] max-h-[120px] resize-none border-0 bg-transparent p-2 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm leading-5"
              style={{ 
                color: '#ffffff',
              }}
              rows={1}
              maxLength={1000}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading || inputValue.length > 1000}
              size="icon"
              className="shrink-0 w-10 h-10 rounded-lg"
              style={{ 
                backgroundColor: clientSettings.primary_color,
                color: '#ffffff'
              }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs" style={{ color: `${clientSettings.text_color}99` }}>
              Press Enter to send, Shift+Enter for new line
            </p>
            <span 
              className="text-xs"
              style={{ color: inputValue.length > 1000 ? '#ef4444' : `${clientSettings.text_color}99` }}
            >
              {inputValue.length}/1000
            </span>
          </div>
          {inputError && (
            <p className="text-xs text-center mt-1" style={{ color: '#ef4444' }}>
              {inputError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FullScreenChatWidget;

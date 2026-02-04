import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  logo_url?: string;
}

interface FunctionalChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  clientId?: string;
  siteId?: string;
  clientSettings?: ClientSettings;
}

// Storage keys for chat widget persistence
const STORAGE_KEY_SESSION_WIDGET = 'chat_widget_session_id';
const STORAGE_KEY_TOKEN_WIDGET = 'chat_widget_session_token';
const STORAGE_KEY_MESSAGES_WIDGET = 'chat_widget_messages';
const storage = sessionStorage;

export const FunctionalChatWidget: React.FC<FunctionalChatWidgetProps> = ({ 
  isOpen, 
  onToggle,
  clientId,
  siteId,
  clientSettings 
}) => {
  const welcomeMessage = clientSettings?.welcome_message || 'Hello! I\'m your AI sales assistant. How can I help you today?';
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: welcomeMessage,
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const savedSessionId = storage.getItem(STORAGE_KEY_SESSION_WIDGET);
        const savedToken = storage.getItem(STORAGE_KEY_TOKEN_WIDGET);
        const savedMessages = storage.getItem(STORAGE_KEY_MESSAGES_WIDGET);

        if (savedSessionId) {
          setSessionId(savedSessionId);
        }
        if (savedToken) {
          setSessionToken(savedToken);
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

  // Save to sessionStorage whenever messages, sessionId, or sessionToken change
  useEffect(() => {
    if (!isLoadingHistory) {
      if (sessionId) {
        storage.setItem(STORAGE_KEY_SESSION_WIDGET, sessionId);
      }
      if (sessionToken) {
        storage.setItem(STORAGE_KEY_TOKEN_WIDGET, sessionToken);
      }
      storage.setItem(STORAGE_KEY_MESSAGES_WIDGET, JSON.stringify(messages));
    }
  }, [messages, sessionId, sessionToken, isLoadingHistory]);

  const sendMessage = async () => {
    const trimmedInput = inputValue.trim();
    
    // Validate input
    if (!trimmedInput) {
      setInputError('Сообщение не может быть пустым');
      return;
    }
    
    if (trimmedInput.length > 1000) {
      setInputError('Сообщение должно быть не более 1000 символов');
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
        clientId: clientId || null,
        sessionId,
        meta: {
          source: 'functional-chat-widget',
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
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    const buttonStyle = clientSettings ? {
      backgroundColor: clientSettings.primary_color,
    } : {};
    
    return (
      <Button
        onClick={onToggle}
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105 overflow-hidden sm:bottom-6 sm:right-6"
        size="icon"
        style={buttonStyle}
      >
        {clientSettings?.logo_url ? (
          <img 
            src={clientSettings.logo_url} 
            alt="Chat" 
            className="w-full h-full object-contain"
          />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>
    );
  }

  const widgetTitle = clientSettings?.widget_title || 'AI Sales Assistant';
  const containerStyle = clientSettings ? {
    backgroundColor: clientSettings.background_color,
    color: clientSettings.text_color,
  } : {};

  return (
    <div 
      className="fixed inset-x-2 bottom-2 z-50 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-lg shadow-2xl animate-in slide-in-from-bottom-2 duration-200 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96 sm:h-[500px]"
      style={{
        ...containerStyle,
        border: `2px solid ${clientSettings?.primary_color || 'hsl(var(--border))'}`
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: clientSettings?.primary_color || 'hsl(var(--border))' }}>
        <div className="flex items-center gap-2">
          {clientSettings?.logo_url ? (
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
              <img 
                src={clientSettings.logo_url} 
                alt="Logo" 
                className="w-full h-full object-contain p-1"
              />
            </div>
          ) : (
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          )}
          <span className="font-medium text-sm">{widgetTitle}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {isLoadingHistory ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {message.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                    {clientSettings?.logo_url ? (
                      <img 
                        src={clientSettings.logo_url} 
                        alt="AI" 
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <MessageCircle className="w-3 h-3" />
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "p-3 rounded-lg text-sm",
                    message.role === 'user' 
                      ? "bg-primary/20 border border-primary/30" 
                      : ""
                  )}
                  style={message.role === 'user' ? {
                    color: clientSettings?.text_color || 'inherit'
                  } : {
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: clientSettings?.text_color || 'hsl(var(--muted-foreground))'
                  }}
                >
                  {message.content}
                </div>
              </div>
            </div>
          ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-2 max-w-[85%]">
                    <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                      {clientSettings?.logo_url ? (
                        <img 
                          src={clientSettings.logo_url} 
                          alt="AI" 
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <MessageCircle className="w-3 h-3" />
                      )}
                    </div>
                    <div className="bg-muted text-muted-foreground p-3 rounded-lg text-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Typing...
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (inputError) setInputError('');
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isLoading}
              className={`${inputError ? 'border-destructive' : ''}`}
              maxLength={1000}
            />
            {inputError && (
              <p className="text-xs text-destructive mt-1">
                {inputError}
              </p>
            )}
          </div>
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading || inputValue.length > 1000}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-end mt-1">
          <span className={`text-xs ${
            inputValue.length > 1000 ? 'text-destructive' : 'text-muted-foreground'
          }`}>
            {inputValue.length}/1000
          </span>
        </div>
      </div>
    </div>
  );
};

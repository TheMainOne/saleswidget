import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, MessageCircle, RotateCcw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { sendAiwChat } from '@/lib/aiw-chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Use sessionStorage instead of localStorage for better security (clears on tab close)
const STORAGE_KEY_SESSION = 'chat_session_id';
const STORAGE_KEY_TOKEN = 'chat_session_token';
const STORAGE_KEY_MESSAGES = 'chat_messages';
const storage = sessionStorage;

const ChatGPTStyleChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI advisor. How can I help you today?',
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
  const isMobile = useIsMobile();

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
        // Try to load sessionId and token from sessionStorage
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

  // Save to sessionStorage whenever messages, sessionId, or sessionToken changes
  useEffect(() => {
    if (!isLoadingHistory && sessionId) {
      storage.setItem(STORAGE_KEY_SESSION, sessionId);
      storage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    }
    if (!isLoadingHistory && sessionToken) {
      storage.setItem(STORAGE_KEY_TOKEN, sessionToken);
    }
  }, [messages, sessionId, sessionToken, isLoadingHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        siteId: 'widget',
        sessionId,
        meta: {
          source: 'chatgpt-style-chat',
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
      // Return focus to textarea after sending
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
        content: 'Hello! I\'m your AI advisor. How can I help you today?',
        timestamp: new Date()
      }
    ]);
    setSessionId(null);
    setSessionToken(null);
    // Clear sessionStorage
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
    <div className={`flex flex-col bg-background border border-border rounded-lg shadow-lg overflow-hidden ${isMobile ? 'h-[70vh] min-h-[480px]' : 'h-[600px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <MessageCircle className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI Advisor</h3>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetChat}
          className="flex items-center gap-2"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto py-4">
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
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {message.role === 'user' ? (
                    <span className="text-sm font-medium">U</span>
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                </div>

                {/* Message Content */}
                <div className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <span className={`text-xs mt-1 block ${
                    message.role === 'user' 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  }`}>
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
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-card border border-border text-foreground">
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
      <div className="border-t border-border p-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-3 bg-card rounded-xl border border-border p-3">
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
              className={`min-h-[44px] max-h-[120px] resize-none border-0 bg-transparent p-2 focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground text-sm leading-5 ${
                inputError ? 'border-destructive' : ''
              }`}
              rows={1}
              maxLength={1000}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading || inputValue.length > 1000}
              size="icon"
              className="shrink-0 w-10 h-10 rounded-lg"
            >
              <Send className="w-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Press Enter to send, Shift+Enter for new line
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${
                inputValue.length > 1000 ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {inputValue.length}/1000
              </span>
            </div>
          </div>
          {inputError && (
            <p className="text-xs text-destructive mt-1 text-center">
              {inputError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatGPTStyleChat;

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowUp, Loader2, RotateCcw, Maximize2 } from 'lucide-react';
import LandingFullScreenChat from './LandingFullScreenChat';
import { sendAiwChat } from '@/lib/aiw-chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const STORAGE_KEY_SESSION = 'landing_chat_session_id';
const STORAGE_KEY_TOKEN = 'landing_chat_session_token';
const STORAGE_KEY_MESSAGES = 'landing_chat_messages';
const STORAGE_KEY_MSG_COUNT = 'landing_chat_user_msg_count';

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: "Hi! I can show how this widget answers questions and qualifies visitors directly on a website.\n\nYou can ask about:\n• pricing\n• lead qualification\n• integrations",
    timestamp: new Date()
  },
  {
    id: '2',
    role: 'assistant',
    content: "What would you like to try first?",
    timestamp: new Date()
  }
];

interface LandingChatProps {
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

const LandingChat: React.FC<LandingChatProps> = ({ onFullscreenChange }) => {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [contactAsked, setContactAsked] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Notify parent about fullscreen changes
  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);

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
        const savedSessionId = sessionStorage.getItem(STORAGE_KEY_SESSION);
        const savedToken = sessionStorage.getItem(STORAGE_KEY_TOKEN);
        const savedMessages = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
        const savedMsgCount = sessionStorage.getItem(STORAGE_KEY_MSG_COUNT);

        if (savedSessionId) {
          setSessionId(savedSessionId);
        }
        if (savedToken) {
          setSessionToken(savedToken);
        }
        if (savedMsgCount) {
          setUserMessageCount(parseInt(savedMsgCount, 10));
          if (parseInt(savedMsgCount, 10) >= 1) {
            setContactAsked(true);
          }
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

  // Save to sessionStorage
  useEffect(() => {
    if (!isLoadingHistory) {
      if (sessionId) {
        sessionStorage.setItem(STORAGE_KEY_SESSION, sessionId);
      }
      if (sessionToken) {
        sessionStorage.setItem(STORAGE_KEY_TOKEN, sessionToken);
      }
      sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      sessionStorage.setItem(STORAGE_KEY_MSG_COUNT, userMessageCount.toString());
    }
  }, [messages, sessionId, sessionToken, userMessageCount, isLoadingHistory]);

  const sendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isLoading) return;
    if (trimmedInput.length > 1000) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    const newMsgCount = userMessageCount + 1;
    setUserMessageCount(newMsgCount);

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
          isLandingDemo: true,
          source: 'landing-chat',
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

      // Ask for contact after first user message
      if (newMsgCount === 1 && !contactAsked) {
        setContactAsked(true);
        setTimeout(() => {
          const contactMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: "Before we continue — where should I send a short summary of this demo?\n\nA work email is perfect.",
            timestamp: new Date()
          };
          setMessages(prev => [...prev, contactMessage]);
        }, 1500);
      }
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

  const resetChat = () => {
    sessionStorage.removeItem(STORAGE_KEY_SESSION);
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_MESSAGES);
    sessionStorage.removeItem(STORAGE_KEY_MSG_COUNT);
    setMessages(INITIAL_MESSAGES);
    setSessionId(null);
    setSessionToken(null);
    setUserMessageCount(0);
    setContactAsked(false);
  };

  if (isFullscreen) {
    return (
      <LandingFullScreenChat
        messages={messages}
        inputValue={inputValue}
        isLoading={isLoading}
        isLoadingHistory={isLoadingHistory}
        onInputChange={setInputValue}
        onSendMessage={sendMessage}
        onKeyPress={handleKeyPress}
        onClose={() => setIsFullscreen(false)}
        onReset={resetChat}
      />
    );
  }

  return (
    <div 
      className="relative flex h-[70vh] min-h-[460px] w-full flex-col overflow-hidden rounded-xl border border-border bg-card/30 backdrop-blur-sm sm:h-[600px]"
      style={{
        boxShadow: '0 0 60px -20px hsl(var(--primary) / 0.15)'
      }}
    >
      {/* Header - ChatGPT style */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <span className="text-base font-medium text-foreground">AI Assistant</span>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Start over"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start over?</AlertDialogTitle>
                <AlertDialogDescription>
                  Chat history will be deleted. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetChat} className="bg-destructive hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-3 pb-0 pt-4 sm:px-5 sm:pt-5">
        <div className="space-y-4">
          {isLoadingHistory ? (
            <div className="flex justify-center items-center h-full py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in-0 slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap max-w-[85%] ${
                      message.role === 'user'
                        ? 'bg-primary/20 border border-primary/30 text-foreground rounded-br-md'
                        : 'bg-muted/50 text-foreground rounded-bl-md'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-in fade-in-0 duration-200">
                  <div className="bg-muted/50 text-muted-foreground p-4 rounded-2xl rounded-bl-md text-sm flex items-center gap-2 max-w-[85%]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input - seamless */}
      <div className="px-3 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
        <div className="relative">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about pricing, integrations, or lead qualification…"
            disabled={isLoading}
            className="h-12 pr-12 bg-muted/30 border-border/50 placeholder:text-muted-foreground/50 focus-visible:ring-primary"
            maxLength={1000}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-primary hover:bg-primary/90"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LandingChat;

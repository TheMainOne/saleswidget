import React, { useRef, useEffect, useState } from 'react';
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
import { ArrowUp, Loader2, RotateCcw, X } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface LandingFullScreenChatProps {
  messages: Message[];
  inputValue: string;
  isLoading: boolean;
  isLoadingHistory: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onClose: () => void;
  onReset: () => void;
}

const LandingFullScreenChat: React.FC<LandingFullScreenChatProps> = ({
  messages,
  inputValue,
  isLoading,
  isLoadingHistory,
  onInputChange,
  onSendMessage,
  onKeyPress,
  onClose,
  onReset,
}) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewportHeight, setViewportHeight] = useState('100dvh');

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

  // iOS keyboard and viewport handling
  useEffect(() => {
    // Save scroll position before locking
    const scrollY = window.scrollY;
    
    // Block body scroll
    const originalStyle = document.body.style.cssText;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;
    
    // Handle iOS visual viewport changes (keyboard show/hide)
    const handleViewportResize = () => {
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        setViewportHeight(`${vh}px`);
        
        // Scroll input into view when keyboard is open
        if (inputRef.current && document.activeElement === inputRef.current) {
          setTimeout(() => {
            inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }, 100);
        }
      }
    };

    // Handle scroll position reset after keyboard dismisses
    const handleViewportScroll = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportScroll);
      handleViewportResize(); // Initial call
    }

    return () => {
      // Restore original styles
      document.body.style.cssText = originalStyle;
      // Restore scroll position
      window.scrollTo(0, scrollY);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportScroll);
      }
    };
  }, []);

  // Handle input blur to fix iOS scroll issues
  const handleInputBlur = () => {
    // Reset scroll position after keyboard dismisses
    setTimeout(() => {
      window.scrollTo(0, 0);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }, 100);
  };

  // Handle form submission - prevent duplicates by only handling Enter here
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      inputRef.current?.blur(); // Dismiss keyboard on iOS
      setTimeout(() => {
        onSendMessage();
      }, 50);
      // Don't call onKeyPress for Enter - we handle it ourselves to avoid duplicates
      return;
    }
    onKeyPress(e);
  };

  return (
    <>
      {/* Fixed backdrop to prevent page flash during keyboard transitions */}
      <div className="fixed inset-0 z-[99] bg-background" />
      <div 
        ref={containerRef}
        className="fixed inset-x-0 top-0 z-[100] bg-background flex flex-col overflow-hidden"
        style={{ 
          height: viewportHeight,
          touchAction: 'none',
          transition: 'height 0.05s ease-out'
        }}
      >
      {/* Header - ChatGPT style */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50 pt-[max(0.75rem,env(safe-area-inset-top))]">
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
                <AlertDialogAction onClick={onReset} className="bg-destructive hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 px-5 pt-5 pb-0">
        <div className="max-w-3xl mx-auto space-y-4">
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

      {/* Input - seamless with safe area */}
      <div className="flex-shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="max-w-3xl mx-auto relative">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            onBlur={handleInputBlur}
            placeholder="Ask about pricing, integrations, or lead qualification…"
            disabled={isLoading}
            className="h-12 pr-12 bg-muted/30 border-border/50 placeholder:text-muted-foreground/50 focus-visible:ring-primary text-base"
            style={{ fontSize: '16px' }} // Prevent iOS zoom on focus
            maxLength={1000}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <Button
            onClick={() => {
              inputRef.current?.blur();
              setTimeout(() => onSendMessage(), 50);
            }}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-primary hover:bg-primary/90"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
    </>
  );
};

export default LandingFullScreenChat;
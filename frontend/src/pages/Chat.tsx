import { useState, useEffect } from 'react';
import { ChatInput } from '../components/chat/ChatInput';
import { UserMessage, KajuMessage, SuggestedPrompt } from '../components/chat/Messages';
import { AgentActivity } from '../components/chat/AgentActivity';
import { TripContextPanel } from '../components/trips/TripContextPanel';
import { DependencyGraph } from '../components/trips/DependencyGraph';
import { mockTripData, mockChatMessages, mockAgents } from '../data/mockData';
import { Icon } from '../components/ui/Icon';

export function Chat() {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isCoordinating, setIsCoordinating] = useState(false);

  // Auto-scroll ref
  const bottomRef = useState<HTMLDivElement | null>(null);

  const startConversation = () => {
    setIsStarted(true);
    setMessages([mockChatMessages[0]]);
    setIsCoordinating(true);
    
    // Simulate kaju thinking and replying after a short delay
    setTimeout(() => {
      setMessages([mockChatMessages[0], mockChatMessages[1]]);
      
      // Simulate coordination finishing
      setTimeout(() => {
        setIsCoordinating(false);
        setMessages([
          mockChatMessages[0],
          {
            ...mockChatMessages[1],
            isThinking: false,
          }
        ]);
      }, 3000);
    }, 1000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setInputValue('');
    if (!isStarted) {
      startConversation();
    }
  };

  const handleSuggestedPrompt = (text: string) => {
    setInputValue(text);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative max-w-4xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-32">
          {!isStarted ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-xl mx-auto space-y-8 animate-in fade-in duration-700">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-primary">
                <Icon name="sparkles" className="text-4xl text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-3">Hi, I'm kaju.</h1>
                <p className="text-secondary-text text-lg leading-relaxed">
                  Tell me what's changed with your trip, and I'll figure out what needs to happen next.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-8">
                <SuggestedPrompt text="My flight was cancelled" onClick={() => handleSuggestedPrompt("My flight was cancelled")} />
                <SuggestedPrompt text="Find me a hotel near the airport" onClick={() => handleSuggestedPrompt("Find me a hotel near the airport")} />
                <SuggestedPrompt text="Move tomorrow's dinner reservation" onClick={() => handleSuggestedPrompt("Move tomorrow's dinner reservation")} />
                <SuggestedPrompt text="The weather changed. What does that affect?" onClick={() => handleSuggestedPrompt("The weather changed. What does that affect?")} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col max-w-3xl mx-auto w-full pb-8">
              {messages.map((msg, idx) => {
                if (msg.role === 'user') {
                  return <UserMessage key={msg.id || idx} content={msg.content} />;
                }
                
                return (
                  <KajuMessage key={msg.id || idx} isThinking={msg.isThinking}>
                    <p>{msg.content}</p>
                    {isCoordinating && msg.isThinking && (
                      <div className="mt-6">
                        <AgentActivity agents={mockAgents} />
                      </div>
                    )}
                    {!msg.isThinking && !isCoordinating && (
                      <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <DependencyGraph nodes={mockTripData.nodes} />
                        <p className="pt-2 text-accent font-medium">
                          Your cancelled flight affects the airport transfer and hotel check-in.
                          <br/><br/>
                          <span className="text-primary-text font-normal">I'm looking for alternatives that keep your existing plans intact.</span>
                        </p>
                      </div>
                    )}
                  </KajuMessage>
                );
              })}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-surface via-surface to-transparent pt-12">
          <div className="max-w-3xl mx-auto">
            <ChatInput 
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSend}
              isLoading={isCoordinating}
            />
          </div>
        </div>
      </div>

      {/* Desktop Trip Context Panel */}
      <div className="hidden lg:block">
        <TripContextPanel data={mockTripData} />
      </div>
    </div>
  );
}

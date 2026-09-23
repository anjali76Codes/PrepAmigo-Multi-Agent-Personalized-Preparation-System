import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
  const shouldReduceMotion = useReducedMotion();

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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative mx-auto w-full">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-32">
          {!isStarted ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col items-center justify-center h-full text-center max-w-xl mx-auto space-y-8"
            >
              <motion.div variants={itemVariants} className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-primary">
                <Icon name="sparkles" className="text-4xl text-white" />
              </motion.div>
              <div>
                <motion.h1 variants={itemVariants} className="text-3xl font-bold mb-3">Hi, I'm kaju.</motion.h1>
                <motion.p variants={itemVariants} className="text-secondary-text text-lg leading-relaxed">
                  Tell me what's changed with your trip, and I'll figure out what needs to happen next.
                </motion.p>
              </div>

              <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-8">
                <SuggestedPrompt text="My flight was cancelled" onClick={() => handleSuggestedPrompt("My flight was cancelled")} />
                <SuggestedPrompt text="Find me a hotel near the airport" onClick={() => handleSuggestedPrompt("Find me a hotel near the airport")} />
                <SuggestedPrompt text="Move tomorrow's dinner reservation" onClick={() => handleSuggestedPrompt("Move tomorrow's dinner reservation")} />
                <SuggestedPrompt text="The weather changed. What does that affect?" onClick={() => handleSuggestedPrompt("The weather changed. What does that affect?")} />
              </motion.div>
            </motion.div>
          ) : (
            <div className="flex flex-col max-w-3xl mx-auto w-full pb-8 space-y-2">
              {messages.map((msg, idx) => {
                if (msg.role === 'user') {
                  return (
                    <motion.div key={msg.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <UserMessage content={msg.content} />
                    </motion.div>
                  );
                }

                return (
                  <motion.div key={msg.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <KajuMessage isThinking={msg.isThinking}>
                      <p>{msg.content}</p>
                      {isCoordinating && msg.isThinking && (
                        <div className="mt-6">
                          <AgentActivity agents={mockAgents} />
                        </div>
                      )}
                      {!msg.isThinking && !isCoordinating && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="mt-4 space-y-4"
                        >
                          <DependencyGraph nodes={mockTripData.nodes} />
                          <p className="pt-2 text-accent font-medium">
                            Your cancelled flight affects the airport transfer and hotel check-in.
                            <br /><br />
                            <span className="text-primary-text font-normal">I'm looking for alternatives that keep your existing plans intact.</span>
                          </p>
                        </motion.div>
                      )}
                    </KajuMessage>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input Area */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-surface via-surface to-transparent pt-12 w-full"
        >
          <div className="max-w-3xl mx-auto">
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSend}
              isLoading={isCoordinating}
            />
          </div>
        </motion.div>
      </div>

      {/* Desktop Trip Context Panel */}
      <div className="hidden lg:block">
        <TripContextPanel data={mockTripData} className="!bg-black/20" />
      </div>
    </div>
  );
}

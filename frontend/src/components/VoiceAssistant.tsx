import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { Mic, MicOff, MessageCircle, X, Send } from 'lucide-react'; // assuming lucide-react
import { AgentStreamClient } from '../lib/agentStream/agentStreamClient';

export const VoiceAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'listening' | 'thinking' | 'researching' | 'speaking'>('idle');
  const [messages, setMessages] = useState<{role: 'user'|'assistant', text: string}[]>([]);
  const [textInput, setTextInput] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const researchClientRef = useRef<AgentStreamClient | null>(null);
  const processInputRef = useRef<(transcript: string) => void>(() => undefined);
  const threadIdRef = useRef(`voice-${Date.now()}`);
  const stateRef = useRef(state);
  stateRef.current = state;
  const navigate = useNavigate();

  useEffect(() => {
    researchClientRef.current = new AgentStreamClient();
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          processInputRef.current(transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setState('idle');
        };

        recognitionRef.current.onend = () => {
          if (stateRef.current === 'listening') {
            stateRef.current = 'idle';
            setState('idle');
          }
        };
      }
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      recognitionRef.current?.stop();
      synthRef.current?.cancel();
      researchClientRef.current?.close();
    };
  }, []);

  const toggleListen = () => {
    if (state === 'listening') {
      recognitionRef.current?.stop();
      stateRef.current = 'idle';
      setState('idle');
    } else {
      synthRef.current?.cancel();
      try {
        recognitionRef.current?.start();
        stateRef.current = 'listening';
        setState('listening');
      } catch (e) {
        console.error("Microphone start failed", e);
      }
    }
  };

  const handleProcess = async (transcript: string) => {
    setMessages(prev => [...prev, { role: 'user', text: transcript }]);
    setState('thinking');
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/voice/process`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, sessionId: 'session-123' })
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const { spokenAnswer, navigation } = data;
      if (data.forwardToResearchAgent) {
        setState('researching');
        if (!researchClientRef.current) {
          researchClientRef.current = new AgentStreamClient();
        }
        await researchClientRef.current.startAgentRun(
          `Answer this candidate's question directly. Do not create or modify a preparation plan unless explicitly asked. Question: ${transcript}`,
          {
            onCompleted: (payload) => {
              const answer = payload?.message || payload?.result?.summary;
              finishAgentResponse(
                typeof answer === 'string' && answer.trim()
                  ? answer
                  : 'The Research Agent completed, but did not return a response.',
              );
            },
            onWaiting: (payload) => {
              const clarification = [
                payload?.question?.question,
                payload?.question,
                payload?.message,
              ].find((value) => typeof value === 'string' && value.trim());
              finishAgentResponse(clarification || 'The Research Agent needs more information to answer that.');
            },
            onError: (error) => {
              const message = error instanceof Error
                ? error.message
                : [error?.error, error?.detail, error?.message].find((value) => typeof value === 'string');
              finishAgentResponse(
                typeof message === 'string'
                  ? `The Research Agent could not answer: ${message}`
                  : 'The Research Agent is unavailable right now. Please try again.',
              );
            },
          },
          threadIdRef.current,
        );
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', text: spokenAnswer }]);
      speak(spokenAnswer);
      if (navigation && navigation.route) {
        navigate(navigation.route);
      }
      
    } catch (error) {
      console.error(error);
      const fallback = "I'm sorry, I couldn't process that right now.";
      setMessages(prev => [...prev, { role: 'assistant', text: fallback }]);
      speak(fallback);
    }
  };

  const finishAgentResponse = (answer: string) => {
    setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    speak(answer);
  };

  processInputRef.current = (transcript) => {
    stateRef.current = 'thinking';
    void handleProcess(transcript);
  };

  const speak = (text: string) => {
    if (synthRef.current) {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => {
        stateRef.current = 'speaking';
        setState('speaking');
      };
      utterance.onend = () => {
        stateRef.current = 'idle';
        setState('idle');
      };
      synthRef.current.speak(utterance);
    } else {
      setState('idle');
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const text = textInput;
    setTextInput('');
    handleProcess(text);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl w-80 h-[400px] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex justify-between items-center p-4 bg-indigo-600 text-white">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageCircle size={18} />
              PrepAmigo Voice
            </h3>
            <button onClick={() => setIsOpen(false)}><X size={18} /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-10">How can I help you with your preparation today?</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`p-3 rounded-lg max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-900/30 ml-auto' : 'bg-gray-100 dark:bg-gray-700 mr-auto'}`}>
                <p className="text-sm dark:text-gray-200">{msg.text}</p>
              </div>
            ))}
          </div>

          <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col gap-2">
            <div className="flex items-center justify-between px-2">
               <span className="text-xs font-medium text-gray-500">
                 {state === 'listening' ? 'Listening...' : state === 'thinking' ? 'Thinking...' : state === 'researching' ? 'Researching...' : state === 'speaking' ? 'Speaking...' : 'Idle'}
               </span>
            </div>
            
            <form onSubmit={handleTextSubmit} className="flex gap-2 relative">
              <input 
                type="text" 
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Type or speak..."
                className="w-full bg-white dark:bg-gray-900 border dark:border-gray-600 rounded-full px-4 py-2 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="absolute right-1 top-1 bottom-1 flex gap-1">
                <button 
                  type="submit"
                  disabled={!textInput.trim() || state === 'thinking' || state === 'researching'}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
                <button 
                  type="button"
                  onClick={toggleListen}
                  disabled={state === 'thinking' || state === 'researching'}
                  className={`p-1.5 rounded-full text-white ${state === 'listening' ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}
                >
                  {state === 'listening' ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-xl transition-transform hover:scale-105"
        >
          <Mic size={24} />
        </button>
      )}
    </div>
  );
};

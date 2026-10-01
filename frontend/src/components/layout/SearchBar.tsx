import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { useAppContext } from '../../context/AppContext';

export function SearchBar() {
  const navigate = useNavigate();
  const { preps } = useAppContext();
  const prep = preps[0];
  const streak = prep?.learningContext?.progress?.streak || 0;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    { label: 'Go to Calendar', type: 'page', path: '/dashboard/calendar' },
    { label: 'Go to Roadmap', type: 'page', path: '/dashboard/roadmap' },
    { label: 'Go to Progress', type: 'page', path: '/dashboard/progress' },
    { label: 'Message PrepAmigo', type: 'action', path: '/dashboard/chat' },
    { label: 'System Design Quiz', type: 'task', path: '/dashboard/roadmap' },
    { label: 'DSA Flashcards', type: 'task', path: '/dashboard/roadmap' },
  ].filter(s => s.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        navigate(suggestions[selectedIndex].path);
        setIsOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="w-full bg-transparent backdrop-blur-md px-6 md:px-12 py-4 flex items-center justify-between gap-4 z-40 relative sticky top-0">
      <div className="flex-1 relative max-w-3xl" ref={containerRef}>
        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-carbon-900 text-lg" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, topics, or ask PrepAmigo..."
            className="w-full bg-lavender-100/90 rounded-full py-2.5 pl-11 pr-4 outline-none focus:border-navy-500 focus:bg-white transition-colors shadow-sm text-sm font-medium"
          />
        </div>

        {isOpen && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border rounded-xl shadow-pop py-2 z-50">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.label}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  navigate(suggestion.path);
                  setIsOpen(false);
                  setQuery('');
                }}
                className={`px-4 py-2 cursor-pointer flex items-center gap-3 transition-colors ${selectedIndex === index ? 'bg-surface-muted text-carbon-900' : 'text-carbon-700 hover:bg-surface-muted'
                  }`}
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center shrink-0">
                  <Icon name={suggestion.type === 'page' ? 'document-text-outline' : suggestion.type === 'action' ? 'chatbubbles-outline' : 'checkbox-outline'} className="text-carbon-500 text-sm" />
                </div>
                <span className="font-medium text-sm">{suggestion.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Streak and Profile on Right */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 bg-sunny-100 text-bg px-3 py-1.5 rounded-xl font-semibold text-sm">
          <Icon name="flame" /> {streak}
        </div>
        <div className="w-10 h-10 rounded-full bg-navy-100 text-navy-800 flex items-center justify-center cursor-pointer hover:bg-navy-200 transition-colors">
          <Icon name="person" className="text-xl" />
        </div>
      </div>
    </div>
  );
}

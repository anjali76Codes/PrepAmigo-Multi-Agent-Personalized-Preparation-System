import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';

export function Notifications() {
  const shouldReduceMotion = useReducedMotion();
  const { notifications: mockNotifications } = useAppContext();
  const [notifications, setNotifications] = useState(mockNotifications.map(n => ({ ...n, read: false })));
  const [filter, setFilter] = useState<string>('all');
  
  const filteredNotifs = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case 'reminder': return 'time-outline';
      case 'missed-task': return 'warning-outline';
      case 'plan-update': return 'sync-outline';
      case 'quiz-result': return 'analytics-outline';
      case 'streak-warning': return 'flame-outline';
      case 'milestone-unlock': return 'trophy-outline';
      default: return 'notifications-outline';
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case 'missed-task': 
      case 'streak-warning': 
        return 'bg-[var(--color-amber-600)]/10 text-[var(--color-amber-600)] border-warning/20';
      case 'plan-update':
      case 'quiz-result':
        return 'bg-[var(--color-forest-700)]/10 text-[var(--color-forest-700)] border-accent/20';
      case 'milestone-unlock':
        return 'bg-[var(--color-navy-900)]/10 text-[var(--color-forest-700)] border-primary/20';
      default: 
        return 'bg-[var(--color-surface)] text-[var(--color-navy-500)] border-[var(--color-border)]';
    }
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-bg)] h-full overflow-hidden">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 z-10 sticky top-0 px-4 md:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-forest-700)]-text mb-2">Notifications</h1>
            <p className="text-[var(--color-navy-500)]">Stay updated on your learning journey.</p>
          </div>
          <div className="flex gap-4">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-control)] px-3 py-2 text-[var(--color-forest-700)]-text text-sm"
            >
              <option value="all">All notifications</option>
              <option value="missed-task">Missed tasks</option>
              <option value="plan-update">Plan updates</option>
              <option value="reminder">Reminders</option>
            </select>
            <Button variant="outline" onClick={markAllRead}>Mark all read</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-4 pb-12"
        >
          {filteredNotifs.length > 0 ? filteredNotifs.map(notif => (
            <Card 
              key={notif.id} 
              className={`p-6 transition-all duration-300 ${notif.read ? 'bg-[var(--color-bg)] border-[var(--color-border)]/50 opacity-75' : 'bg-[var(--color-surface)] border-primary/20 shadow-[var(--shadow-card)]'}`}
              onClick={() => markRead(notif.id)}
            >
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center border ${getStyles(notif.type)}`}>
                  <Icon name={getIcon(notif.type)} className="text-2xl" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-semibold ${notif.read ? 'text-[var(--color-forest-700)]-text' : 'text-[var(--color-forest-700)]'}`}>{notif.title}</h3>
                    <span className="text-xs text-[var(--color-navy-500)] whitespace-nowrap">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-navy-500)] mb-2">{notif.message}</p>
                  {notif.reason && (
                    <div className="text-xs bg-[var(--color-bg)] p-2 rounded border border-[var(--color-border)] inline-block">
                      <span className="font-medium">Reason:</span> {notif.reason}
                    </div>
                  )}
                  {notif.type === 'missed-task' && !notif.read && (
                    <div className="mt-3">
                      <Button size="sm">Reschedule Task</Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )) : (
            <div className="text-center py-12 text-[var(--color-navy-500)]">
              <Icon name="notifications-off-outline" className="text-4xl mb-4 opacity-50" />
              <p>No notifications match this filter.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

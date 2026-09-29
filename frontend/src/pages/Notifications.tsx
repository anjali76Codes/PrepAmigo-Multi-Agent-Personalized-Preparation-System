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
        return 'bg-warning/10 text-warning border-warning/20';
      case 'plan-update':
      case 'quiz-result':
        return 'bg-accent/10 text-accent border-accent/20';
      case 'milestone-unlock':
        return 'bg-primary/10 text-primary border-primary/20';
      default: 
        return 'bg-surface text-secondary-text border-border';
    }
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <div className="border-b border-border bg-surface shrink-0 z-10 sticky top-0 px-4 md:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary-text mb-2">Notifications</h1>
            <p className="text-secondary-text">Stay updated on your learning journey.</p>
          </div>
          <div className="flex gap-4">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-primary-text text-sm"
            >
              <option value="all">All notifications</option>
              <option value="missed-task">Missed tasks</option>
              <option value="plan-update">Plan updates</option>
              <option value="reminder">Reminders</option>
            </select>
            <Button variant="secondary" onClick={markAllRead}>Mark all read</Button>
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
              className={`p-6 transition-all duration-300 ${notif.read ? 'bg-background border-border/50 opacity-75' : 'bg-surface border-primary/20 shadow-sm'}`}
              onClick={() => markRead(notif.id)}
            >
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center border ${getStyles(notif.type)}`}>
                  <Icon name={getIcon(notif.type)} className="text-2xl" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-semibold ${notif.read ? 'text-primary-text' : 'text-primary'}`}>{notif.title}</h3>
                    <span className="text-xs text-secondary-text whitespace-nowrap">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-secondary-text mb-2">{notif.message}</p>
                  {notif.reason && (
                    <div className="text-xs bg-background p-2 rounded border border-border inline-block">
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
            <div className="text-center py-12 text-secondary-text">
              <Icon name="notifications-off-outline" className="text-4xl mb-4 opacity-50" />
              <p>No notifications match this filter.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';

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
        return 'bg-beige-100 text-beige-600 border-beige-600/20';
      case 'plan-update':
      case 'quiz-result':
        return 'bg-navy-100 text-navy-700 border-navy-700/20';
      case 'milestone-unlock':
        return 'bg-navy-100 text-navy-700 border-navy-700/20';
      default: 
        return 'bg-surface text-carbon-500 border-border';
    }
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="bg-bg shrink-0 z-10 sticky top-0 px-4 md:px-8 py-8 md:py-12 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-4xl mx-auto">
          <div>
            <h1 className="text-4xl font-extrabold text-carbon-900 mb-2 tracking-tight">Notifications</h1>
            <p className="text-lg text-carbon-500">Stay updated on your learning journey.</p>
          </div>
          <div className="flex gap-4">
            <Select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white border-border rounded-xl"
            >
              <option value="all">All notifications</option>
              <option value="missed-task">Missed tasks</option>
              <option value="plan-update">Plan updates</option>
              <option value="reminder">Reminders</option>
            </Select>
            <Button variant="outline" onClick={markAllRead} className="rounded-xl border-border hover:bg-surface-muted bg-white">Mark all read</Button>
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
            <div 
              key={notif.id} 
              className={`p-6 rounded-[2rem] border transition-all duration-300 cursor-pointer hover:-translate-y-1 ${notif.read ? 'bg-white/50 border-border opacity-75' : 'bg-white border-border shadow-pop'}`}
              onClick={() => markRead(notif.id)}
            >
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center border ${getStyles(notif.type)}`}>
                  <Icon name={getIcon(notif.type)} className="text-2xl" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-semibold ${notif.read ? 'text-carbon-900' : 'text-navy-700'}`}>{notif.title}</h3>
                    <span className="text-xs text-carbon-500 whitespace-nowrap">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-carbon-500 mb-2">{notif.message}</p>
                  {notif.reason && (
                    <div className="text-xs bg-bg p-2 rounded-control border border-border inline-block">
                      <span className="font-medium text-carbon-900">Reason:</span> {notif.reason}
                    </div>
                  )}
                  {notif.type === 'missed-task' && !notif.read && (
                    <div className="mt-3">
                      <Button variant="primary" size="sm">Reschedule Task</Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-12 text-carbon-500">
              <Icon name="notifications-off-outline" className="text-4xl mb-4 opacity-50" />
              <p>No notifications match this filter.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

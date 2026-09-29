
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { PrepOverview } from '../components/preps/PrepOverview';

import { SkillGapMap } from '../components/preps/SkillGapMap';
import { AffectedTopics } from '../components/preps/AffectedTopics';
import { PlanUpdateTimeline } from '../components/preps/PlanUpdateTimeline';
import { LearningContextPanel } from '../components/preps/LearningContextPanel';
import { RoadmapView } from '../components/preps/RoadmapView';
import { PlanCalendar } from '../components/preps/PlanCalendar';
import { ResourcePack } from '../components/preps/ResourcePack';
import { AssessmentCard } from '../components/preps/AssessmentCard';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';


export function PrepDetails() {
  const { prepId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  const { preps, agentEvents: mockAgentEvents, notifications: mockNotifications } = useAppContext();
  const prep = preps.find(p => p.id === prepId);

  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'overview';

  if (!prep) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <h2 className="text-2xl font-bold text-primary-text mb-4">Prep not found</h2>
        <Button onClick={() => navigate('/app/preps')}>Back to Preps</Button>
      </div>
    );
  }

  const setTab = (tab: string) => {
    navigate(`/app/preps/${prepId}?tab=${tab}`, { replace: true });
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'eye-outline' },
    { id: 'skill-gaps', label: 'Skill Gaps', icon: 'git-network-outline' },
    { id: 'roadmap', label: 'Roadmap', icon: 'map-outline' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
    { id: 'resources', label: 'Resource Pack', icon: 'book-outline' },
    { id: 'assessments', label: 'Assessments', icon: 'clipboard-outline' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <PrepOverview context={prep.learningContext} />
              <div className="bg-surface border border-border p-6 rounded-2xl">
                <h3 className="text-lg font-semibold mb-4 text-primary-text">What the Agents Found</h3>
                <div className="space-y-4">
                  {mockAgentEvents.map(event => (
                    <div key={event.id} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                        <Icon name="scan-outline" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-primary-text">{event.agent}</div>
                        <div className="text-sm text-secondary-text mt-1">{event.action}</div>
                        <div className="text-xs text-secondary-text/60 mt-1">{new Date(event.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <LearningContextPanel context={prep.learningContext} />
            </div>
          </div>
        );
      case 'skill-gaps':
        return (
          <div className="space-y-6 max-w-4xl">
            <SkillGapMap gaps={prep.learningContext.knowledgeGaps} skills={prep.learningContext.candidateSkills} />
            <AffectedTopics topics={['System Design', 'Graphs']} />
          </div>
        );
      case 'roadmap':
        return (
          <div className="space-y-8 max-w-4xl">
            <RoadmapView roadmap={prep.roadmap} />
            <PlanUpdateTimeline updates={mockNotifications} />
          </div>
        );
      case 'calendar':
        return (
          <PlanCalendar entries={prep.calendarEntries} />
        );
      case 'resources':
        return (
          <div className="space-y-6 max-w-4xl">
            {prep.learningContext.resources.map(pack => (
              <ResourcePack key={pack.topic} pack={pack} />
            ))}
          </div>
        );
      case 'assessments':
        return (
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl">
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-primary-text mb-4">Weekly Quizzes</h3>
              {prep.assessments.quizzes.map(quiz => (
                <AssessmentCard key={quiz.id} item={quiz} type="quiz" />
              ))}
            </div>
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-primary-text mb-4">Flashcard Decks</h3>
              {prep.assessments.flashcardDecks.map(deck => (
                <AssessmentCard key={deck.id} item={deck} type="flashcard" />
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <div className="border-b border-border bg-surface shrink-0 z-10 sticky top-0">
        <div className="px-4 md:px-8 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/app/preps')} className="hidden md:flex p-2 -ml-2 rounded-full">
            <Icon name="arrow-back-outline" className="text-xl" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary-text">{prep.title}</h1>
            <p className="text-sm text-secondary-text">{prep.durationDays} Days • {prep.learningContext.targetRole}</p>
          </div>
        </div>
        
        <div className="flex overflow-x-auto hide-scrollbar px-4 md:px-8 gap-6 border-t border-border mt-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-secondary-text hover:text-primary-text'
              }`}
            >
              <Icon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {renderTabContent()}
        </motion.div>
      </div>
    </div>
  );
}

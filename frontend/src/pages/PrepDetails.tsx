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

  const { preps, notifications: mockNotifications } = useAppContext();
  const prep = preps.find(p => p.id === prepId);

  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'overview';

  if (!prep) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg">
        <h2 className="text-2xl font-bold text-carbon-900 mb-4">Prep not found</h2>
        <Button onClick={() => navigate('/dashboard/preps')}>Back to Preps</Button>
      </div>
    );
  }

  const setTab = (tab: string) => {
    navigate(`/dashboard/preps/${prepId}?tab=${tab}`, { replace: true });
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
          <div className="grid md:grid-cols-4 gap-6">
            <div className="md:col-span-3 space-y-6">
              <PrepOverview context={prep.learningContext} />
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
          <div className="space-y-8 grid grid-cols-4 gap-6">
            <div className="col-span-3">
              <RoadmapView roadmap={prep.roadmap} />
            </div>
            <div className="col-span-1">
              <PlanUpdateTimeline updates={mockNotifications} />
            </div>
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
              <h3 className="text-xl font-bold text-carbon-900 mb-4">Weekly Quizzes</h3>
              {prep.assessments.quizzes.map(quiz => (
                <AssessmentCard key={quiz.id} item={quiz} type="quiz" />
              ))}
            </div>
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-carbon-900 mb-4">Flashcard Decks</h3>
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
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="bg-bg shrink-0 z-10 sticky top-0 px-4 md:px-8 pt-8 md:pt-12 border-b border-border">
        <div className="flex items-center gap-6 mb-8">
          <Button variant="ghost" onClick={() => navigate('/dashboard/preps')} className="hidden md:flex p-3 -ml-3 rounded-full hover:bg-surface border border-transparent hover:border-border transition-all">
            <Icon name="arrow-back" className="text-2xl" />
          </Button>
          <div>
            <h1 className="text-4xl font-extrabold text-carbon-900 tracking-tight mb-2">{prep.title}</h1>
            <p className="text-lg text-carbon-500 font-medium">
              <span className="text-chrome-accent">{prep.durationDays} Days</span> • {prep.learningContext.targetRole}
            </p>
          </div>
        </div>

        <div className="flex overflow-x-auto hide-scrollbar gap-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 py-4 border-b-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === tab.id
                ? 'border-chrome-accent text-chrome-accent'
                : 'border-transparent text-carbon-500 hover:text-carbon-900'
                }`}
            >
              <Icon name={tab.icon.replace('-outline', '')} className="text-lg" />
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

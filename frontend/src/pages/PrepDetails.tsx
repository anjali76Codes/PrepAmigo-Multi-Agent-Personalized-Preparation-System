import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { PrepOverview } from '../components/preps/PrepOverview';
import { SkillGapMap } from '../components/preps/SkillGapMap';
import { AffectedTopics } from '../components/preps/AffectedTopics';
import { LearningContextPanel } from '../components/preps/LearningContextPanel';
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
    { id: 'skill-gaps', label: 'Skill Gaps', icon: 'git-network-outline' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="grid md:grid-cols-4 gap-6">
            <div className="md:col-span-3 space-y-6">
              <PrepOverview context={prep.learningContext} />
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                <Button variant="outline" onClick={() => navigate('/roadmap')} className="flex flex-col items-center justify-center p-6 h-auto gap-3 bg-surface hover:bg-bg border-border text-carbon-700 hover:text-chrome transition-all shadow-sm">
                  <Icon name="map-outline" className="text-3xl" />
                  <span className="font-bold">Roadmap</span>
                </Button>
                <Button variant="outline" onClick={() => navigate('/calendar')} className="flex flex-col items-center justify-center p-6 h-auto gap-3 bg-surface hover:bg-bg border-border text-carbon-700 hover:text-chrome transition-all shadow-sm">
                  <Icon name="calendar-outline" className="text-3xl" />
                  <span className="font-bold">Calendar</span>
                </Button>
                <Button variant="outline" onClick={() => navigate('/resource-pack')} className="flex flex-col items-center justify-center p-6 h-auto gap-3 bg-surface hover:bg-bg border-border text-carbon-700 hover:text-chrome transition-all shadow-sm">
                  <Icon name="book-outline" className="text-3xl" />
                  <span className="font-bold">Resource Pack</span>
                </Button>
                <Button variant="outline" onClick={() => navigate('/assessment')} className="flex flex-col items-center justify-center p-6 h-auto gap-3 bg-surface hover:bg-bg border-border text-carbon-700 hover:text-chrome transition-all shadow-sm">
                  <Icon name="clipboard-outline" className="text-3xl" />
                  <span className="font-bold">Assessments</span>
                </Button>
              </div>
            </div>
            <div className="space-y-6">
              <LearningContextPanel context={prep.learningContext} />
            </div>
          </div>
        );
      case 'skill-gaps':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <div className="md:col-span-2 space-y-6">
              <SkillGapMap gaps={prep.learningContext.knowledgeGaps} skills={prep.learningContext.candidateSkills} />
            </div>
            <div className="md:col-span-1 space-y-6">
              <AffectedTopics topics={['System Design', 'Graphs']} />
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
              <span className="text-chrome">{prep.durationDays} Days</span> • {prep.learningContext.targetRole}
            </p>
          </div>
        </div>

        <div className="flex w-full overflow-x-auto hide-scrollbar border-b border-transparent">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex-1 flex justify-center items-center gap-2 py-4 border-b-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === tab.id
                ? 'border-chrome text-chrome'
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

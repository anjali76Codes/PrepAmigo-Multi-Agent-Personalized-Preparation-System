import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { ChatInput } from "../components/chat/ChatInput";
import { SUGGESTED_QUESTIONS } from "../data/mockNotes";

export function ResourcePackHome() {
  const navigate = useNavigate();

  const handleSend = (msg: string) => {
    navigate("/resource-pack/chat", { state: { initialMessage: msg } });
  };

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-6 md:px-12 py-5 shrink-0 z-10 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-carbon-900">Resource Pack</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 safe-area-bottom">
        <div className="max-w-4xl mx-auto space-y-12">
          
          {/* Notes Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-carbon-900">My Notes</h2>
            </div>
            
            <div className="flex gap-6 overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0">
              {['Sprint 1', 'Java Core', 'AWS Info', 'System Design'].map((folder) => (
                <Link
                  key={folder}
                  to={`/resource-pack/notes?folder=${folder}`}
                  className="group flex flex-col items-center gap-3 min-w-[100px] hover:-translate-y-1 transition-transform"
                >
                  <div className="w-20 h-20 rounded-2xl bg-lavender-100 flex items-center justify-center text-navy-500 shadow-sm border border-border group-hover:border-navy-500 group-hover:shadow-md transition-all">
                    <Icon name="folder" className="text-4xl" />
                  </div>
                  <span className="text-sm font-semibold text-carbon-800 text-center w-full truncate px-1">
                    {folder}
                  </span>
                </Link>
              ))}
            </div>
            
            <div>
              <Link to="/resource-pack/notes" className="inline-flex items-center gap-2 text-sm font-bold text-navy-600 hover:text-navy-800">
                View all notes <Icon name="arrow-forward" />
              </Link>
            </div>
          </section>

          {/* Chat Section */}
          <section className="space-y-6 pt-8 border-t border-border max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-carbon-900 text-center">Ask your Notes</h2>
            
            <div className="flex-1">
              <ChatInput onSend={handleSend} placeholder="Ask anything about your notes..." showOptions={false} />
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="px-4 py-2 bg-white border border-border rounded-full text-sm font-medium text-carbon-600 hover:bg-surface-muted hover:text-carbon-900 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

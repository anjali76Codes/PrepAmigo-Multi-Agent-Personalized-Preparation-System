import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { chatHistory as history } from "../data/mockChats";

export function ResourceChatHistory() {

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-6 md:px-12 py-5 shrink-0 z-10 flex items-center gap-4">
        <Link to="/resource-pack/chat" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-carbon-500 hover:bg-surface-muted transition-colors">
          <Icon name="arrow-back" className="text-lg" />
        </Link>
        <h1 className="text-2xl font-extrabold text-carbon-900">Chat History</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 safe-area-bottom">
        <div className="max-w-4xl mx-auto space-y-4">

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Mascot variant="sad.png" size="xl" />
              <p className="font-bold text-lg text-carbon-500">No chat history yet.</p>
            </div>
          ) : (
            history.map(chat => (
              <div key={chat.id} className="bg-white border border-border rounded-xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <h3 className="font-bold text-carbon-900 text-lg">{chat.title}</h3>
                  <p className="text-sm text-carbon-500 mt-1">{chat.time}</p>
                </div>
                <Link to={`/resource-pack/chat/${chat.id}`} className="px-4 py-2 bg-soft-rose text-expresso font-bold rounded-lg hover:bg-navy-200 transition-colors">
                  Go to Chat
                </Link>
              </div>
            ))
          )}

        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { folders, files } from "../data/mockNotes";

export function NotesDirectory() {

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-6 md:px-12 py-5 shrink-0 z-10 flex items-center gap-4">
        <Link to="/resource-pack" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-carbon-500 hover:bg-surface-muted transition-colors">
          <Icon name="arrow-back" className="text-lg" />
        </Link>
        <h1 className="text-2xl font-extrabold text-carbon-900">All Notes</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 safe-area-bottom">
        <div className="max-w-5xl mx-auto">
          
          {folders.length === 0 && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <Mascot variant="sad.png" size="xl" />
              <div className="text-center">
                <h3 className="text-xl font-bold text-carbon-900">It's empty here</h3>
                <p className="text-carbon-500">You haven't added any notes yet.</p>
              </div>
            </div>
          )}

          {folders.length > 0 && (
            <div className="mb-10">
              <h3 className="text-sm font-bold text-carbon-500 uppercase tracking-wider mb-4">Folders</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {folders.map(f => (
                  <div key={f.id} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-sm hover:border-navy-500 transition-all">
                    <Icon name="folder" className="text-3xl text-navy-500" />
                    <div className="overflow-hidden">
                      <div className="font-bold text-carbon-900 truncate">{f.name}</div>
                      <div className="text-xs text-carbon-400">{f.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-carbon-500 uppercase tracking-wider mb-4">Files</h3>
              <div className="space-y-2">
                {files.map(f => (
                  <div key={f.id} className="bg-white border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-surface-muted transition-colors">
                    <div className="flex items-center gap-4">
                      <Icon name={f.type === 'pdf' ? "document" : "document-text"} className={`text-2xl ${f.type === 'pdf' ? 'text-coral-500' : 'text-sky-500'}`} />
                      <span className="font-medium text-carbon-900">{f.name}</span>
                    </div>
                    <span className="text-sm text-carbon-500">{f.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

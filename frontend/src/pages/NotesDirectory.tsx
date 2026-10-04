import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { ResourceDirectory } from "../components/resources/ResourceDirectory";

export function NotesDirectory() {
  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-6 md:px-12 py-5 shrink-0 z-10 flex items-center gap-4">
        <Link to="/resource-pack" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-carbon-500 hover:bg-lavender-100 transition-colors">
          <Icon name="arrow-back" className="text-lg" />
        </Link>
        <h1 className="text-2xl font-extrabold text-carbon-900">Resource Directory</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6 md:p-12 safe-area-bottom">
        <div className="max-w-5xl mx-auto"><ResourceDirectory /></div>
      </div>
    </div>
  );
}
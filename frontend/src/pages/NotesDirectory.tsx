import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { Card } from "../components/ui/Card";
import { Mascot } from "../components/ui/Mascot";
import { ResourceDirectory } from "../components/resources/ResourceDirectory";

export function NotesDirectory() {
  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="flex-1 overflow-y-auto safe-area-bottom">
        <div className="w-full px-6 md:px-12 py-6 md:py-8 space-y-8 pb-12">
          <Card variant="default" className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center gap-6">
            <div className="flex-1 min-w-0 space-y-2">
              <Link to="/resource-pack" className="inline-flex items-center gap-1.5 text-sm font-bold text-chrome hover:underline">
                <Icon name="arrow-back" /> Resource Pack
              </Link>
              <h1 className="text-2xl md:text-3xl font-extrabold text-carbon-900">Resource Directory</h1>
            </div>
            <div className="hidden sm:flex shrink-0">
              <Mascot size="lg" variant="Motivated.png" className="bg-surface border border-border rounded-full p-2" />
            </div>
          </Card>

          <ResourceDirectory />
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Icon } from "../components/ui/Icon";

export function SprintNotes() {
  const { activePrep } = useAppContext();
  const { user } = useAuth();
  const sprints = activePrep?.roadmap?.sprints || [];
  const [selectedSprintId, setSelectedSprintId] = useState(sprints[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(true);

  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId) || sprints[0];
  const storageKey = user && selectedSprint
    ? `prepamigo_sprint_notes_${user.id || user.sub}_${selectedSprint.id}`
    : null;

  useEffect(() => {
    setSelectedSprintId((current) => current || sprints[0]?.id || "");
  }, [sprints]);

  useEffect(() => {
    setNotes(storageKey ? localStorage.getItem(storageKey) || "" : "");
    setSaved(true);
  }, [storageKey]);

  const saveNotes = () => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, notes);
    setSaved(true);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-bg px-6 py-8 md:px-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-carbon-500">Preparation workspace</p>
          <h1 className="mt-1 text-3xl font-extrabold text-carbon-900">Sprint Notes</h1>
          <p className="mt-2 text-sm text-carbon-500">Keep your own notes alongside each sprint.</p>
        </div>

        {!selectedSprint ? (
          <Card variant="default" className="p-8 text-center text-carbon-500">
            Create a preparation plan to start taking sprint notes.
          </Card>
        ) : (
          <Card variant="default" className="space-y-4 p-5 md:p-7">
            <label className="block text-sm font-bold text-carbon-900" htmlFor="sprint-notes-select">Sprint</label>
            <select
              id="sprint-notes-select"
              value={selectedSprint.id}
              onChange={(event) => setSelectedSprintId(event.target.value)}
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-carbon-900 outline-none focus:border-chrome"
            >
              {sprints.map((sprint, index) => (
                <option key={sprint.id} value={sprint.id}>
                  Sprint {index + 1} · {sprint.title}
                </option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setSaved(false);
              }}
              rows={14}
              placeholder="Capture key ideas, questions, and takeaways for this sprint..."
              className="w-full resize-y rounded-2xl border border-border bg-white p-4 text-sm leading-6 text-carbon-900 outline-none placeholder:text-carbon-400 focus:border-chrome"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-carbon-500">
                {saved ? "All changes saved on this device." : "You have unsaved changes."}
              </span>
              <Button onClick={saveNotes} disabled={saved} className="gap-2">
                <Icon name="save-outline" /> Save notes
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

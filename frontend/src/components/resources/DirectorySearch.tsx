import { Icon } from "../ui/Icon";

export function DirectorySearch({ value, onChange, placeholder = "Search folders, topics, resources..." }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <div className="bg-white border border-border rounded-full px-4 py-3 shadow-xs flex items-center gap-3 focus-within:border-chrome-accent transition-colors">
            <Icon name="search" className="text-carbon-400 text-lg" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent outline-none text-sm font-medium text-carbon-900 placeholder:text-carbon-400"
            />
            {value && (
                <button onClick={() => onChange("")} className="text-carbon-400 hover:text-carbon-900">
                    <Icon name="close-circle" className="text-lg" />
                </button>
            )}
        </div>
    );
}
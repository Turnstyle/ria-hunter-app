type QuerySuggestionsProps = {
  onSelect: (query: string) => void;
  suggestions?: string[];
};

const DEFAULT_SUGGESTIONS: string[] = [
  'Top RIAs in Austin with high activity scores and VC focus',
  'Show RIAs with > $500M AUM in San Francisco',
  'Which firms recently added venture funds?'
];

export default function QuerySuggestions({ onSelect, suggestions = DEFAULT_SUGGESTIONS }: QuerySuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((s, i) => (
        <button
          key={`${i}-${s.slice(0, 8)}`}
          type="button"
          onClick={() => onSelect(s)}
          className="text-sm bg-white border border-gray-200 hover:border-gray-300 rounded-full px-3 py-1 shadow-sm"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

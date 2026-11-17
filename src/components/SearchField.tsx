import { IconClose, IconSearch } from "./Icons";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export default function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  label = "Search",
}: SearchFieldProps) {
  return (
    <div className="flex items-center gap-2 bg-surface border border-line rounded-lg px-3 py-2 w-full max-w-md" role="search">
      <IconSearch size={16} className="text-muted" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        className="flex-1 bg-transparent border-none outline-none text-ink placeholder-muted"
      />
      {value && (
        <button
          type="button"
          className="p-1 hover:bg-accent-soft rounded-sm text-muted hover:text-accent"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <IconClose size={13} />
        </button>
      )}
    </div>
  );
}

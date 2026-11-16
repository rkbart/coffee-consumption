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
    <div className="search-field" role="search">
      <IconSearch size={16} className="search-icon" />
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
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <IconClose size={13} />
        </button>
      )}
    </div>
  );
}

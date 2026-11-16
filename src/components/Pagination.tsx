import { IconArrowLeft, IconArrowRight } from "./Icons";

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label: string;
}

type PageToken = number | "gap-before" | "gap-after";

function pageTokens(page: number, pageCount: number): PageToken[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = [...new Set([1, pageCount, page - 1, page, page + 1])]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
  const tokens: PageToken[] = [];
  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) {
      tokens.push(index === 1 ? "gap-before" : "gap-after");
    }
    tokens.push(value);
  });
  return tokens;
}

export default function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  label,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="pagination">
      <p className="pagination-info">
        Showing {start}–{end} of {total} {label}
      </p>
      <nav className="pagination-pages" aria-label={`${label} pages`}>
        <button
          type="button"
          className="page-btn page-step"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <IconArrowLeft size={14} />
        </button>
        {pageTokens(page, pageCount).map((token) =>
          typeof token === "number" ? (
            <button
              type="button"
              key={token}
              className={`page-btn${token === page ? " active" : ""}`}
              onClick={() => onPageChange(token)}
              aria-current={token === page ? "page" : undefined}
              aria-label={`Page ${token}`}
            >
              {token}
            </button>
          ) : (
            <span key={token} className="page-gap" aria-hidden="true">
              …
            </span>
          ),
        )}
        <button
          type="button"
          className="page-btn page-step"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          aria-label="Next page"
        >
          <IconArrowRight size={14} />
        </button>
      </nav>
    </div>
  );
}

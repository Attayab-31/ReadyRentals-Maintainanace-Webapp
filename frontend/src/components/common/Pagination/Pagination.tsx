import styles from "./Pagination.module.css";

interface PaginationProps {
  page: number; // 0-indexed
  totalPages: number;
  onPageChange: (newPage: number) => void;
  disabled?: boolean;
}

export function Pagination({ page, totalPages, onPageChange, disabled }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label="Pagination Navigation">
      <span className={styles.info}>
        Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
      </span>
      <div className={styles.actions}>
        <button
          type="button"
          className="btn"
          disabled={disabled || page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Go to previous page"
        >
          Previous
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled || page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Go to next page"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

import { useEffect, useMemo, useState } from "react";

export const usePagination = <T,>(items: T[], pageSize = 10) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset to page 1 if items shrink below current page
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    totalPages,
    pageSize,
    paged,
    total: items.length,
    next: () => setPage((p) => Math.min(totalPages, p + 1)),
    prev: () => setPage((p) => Math.max(1, p - 1)),
  };
};

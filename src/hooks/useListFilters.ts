import { useMemo } from 'react';

/** Lọc danh sách theo search + các điều kiện tùy chọn */
export function useListFilters<T>(
  items: T[],
  search: string,
  searchKeys: (keyof T)[],
  predicates: ((item: T) => boolean)[] = []
) {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        searchKeys.some((key) => String(item[key] ?? '').toLowerCase().includes(q));
      return matchSearch && predicates.every((p) => p(item));
    });
  }, [items, search, searchKeys, predicates]);
}

import { useCallback, useEffect, useState } from 'react';

/** Hook gọi API async — tái sử dụng loading / reload / error */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi');
      return false;
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

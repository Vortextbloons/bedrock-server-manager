import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ServerStatus } from '@shared/server';

export function useServerStatus(enabled = true) {
  return useQuery({
    queryKey: ['status'],
    queryFn: () => api.get<ServerStatus>('/status'),
    refetchInterval: enabled ? 3000 : false,
    enabled,
  });
}

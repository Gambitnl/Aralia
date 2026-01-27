import { formatGameDateTime } from '@/utils/core';

export const formatQuestDate = (timestamp?: number): string => {
  if (!timestamp) return '—';
  return formatGameDateTime(new Date(timestamp));
};

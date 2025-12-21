import { formatGameDateTime } from '@/utils/timeUtils';

export const formatQuestDate = (timestamp?: number): string => {
  if (!timestamp) return '—';
  return formatGameDateTime(new Date(timestamp));
};

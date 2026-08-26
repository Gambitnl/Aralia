const WILDKIN_ROOT = 'wildkin';

export function pathIsWildkin(value) {
  let path = String(value || '').trim().replace(/\\/g, '/').toLowerCase();
  path = path.replace(/^file:\/+/i, '').replace(/^\/\/\?\//, '').replace(/^\/+/, '');
  path = path.replace(/^\?\//, '').replace(/:\d+$/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  return path === WILDKIN_ROOT
    || path.startsWith(WILDKIN_ROOT + '/')
    || path === 'f:/repos/wildkin'
    || path.startsWith('f:/repos/wildkin/');
}

function hasRepoPath(values) {
  return Array.isArray(values) && values.some(pathIsWildkin);
}

export function campaignKeys(campaign) {
  return [campaign.id, campaign.name, ...(campaign.formerIds || [])]
    .filter(Boolean).map((value) => String(value).toLowerCase());
}

function mentionsWildkinRecord(body, recordIds) {
  const text = String(body || '').toLowerCase();
  if (/(^|[^a-z0-9])wildkin(?=$|[^a-z0-9])/.test(text)) return true;
  return recordIds.some((id) => {
    let offset = text.indexOf(id);
    while (offset !== -1) {
      const before = text[offset - 1] || '';
      const after = text[offset + id.length] || '';
      if (!/[a-z0-9._-]/.test(before) && !/[a-z0-9._-]/.test(after)) return true;
      offset = text.indexOf(id, offset + 1);
    }
    return false;
  });
}

// Agora messages have no repo field. Only explicit Wildkin or scoped record
// references count as Wildkin traffic; sender identity alone is not evidence.
export function scopeRecords(tasks = [], campaigns = [], locks = [], reservations = [], messages = []) {
  const repoCampaigns = campaigns.filter((campaign) =>
    hasRepoPath(campaign.paths) || hasRepoPath(campaign.globs));
  const repoCampaignKeys = new Set(repoCampaigns.flatMap(campaignKeys));
  const repoTasks = tasks.filter((task) => {
    const campaignId = String(task.campaignId || '').toLowerCase();
    return repoCampaignKeys.has(campaignId)
      || hasRepoPath(task.refs)
      || hasRepoPath(task.retraceFiles);
  });
  const repoLocks = locks.filter((lock) =>
    String(lock.repo || '').toLowerCase() === 'wildkin'
      || hasRepoPath(lock.paths)
      || hasRepoPath(lock.globs));
  const repoReservations = reservations.filter((reservation) =>
    hasRepoPath(reservation.paths) || hasRepoPath(reservation.globs));
  const recordIds = [...repoTasks.map((task) => task.id), ...repoCampaigns.map((campaign) => campaign.id)]
    .filter(Boolean).map((id) => String(id).toLowerCase());
  const repoMessages = messages.filter((message) => mentionsWildkinRecord(message.body, recordIds));
  return {
    tasks: repoTasks,
    campaigns: repoCampaigns,
    locks: repoLocks,
    reservations: repoReservations,
    messages: repoMessages,
  };
}

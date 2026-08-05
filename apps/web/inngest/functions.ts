import { refreshFeedView } from '@/lib/feed'
import { inngest } from './client'

type StepLike = { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> }

/**
 * Exported separately from refreshFeedFunction so it can be unit-tested
 * directly with a stub `step`, without needing Inngest's own test runtime.
 */
export async function refreshFeedHandler({ step }: { step: StepLike }): Promise<void> {
  await step.run('refresh-feed-view', () => refreshFeedView())
}

/** Refreshes the feed materialized view once a day — the whole refresh story now that the old CRON_SECRET route is gone. */
export const refreshFeedFunction = inngest.createFunction(
  {
    id: 'refresh-feed',
    name: 'Refresh feed materialized view',
    triggers: [{ cron: '0 0 * * *' }],
  },
  refreshFeedHandler,
)

import { AGENT_INVENTORY } from '@aifit/agents';
import { json } from '@/server/platform';
import { agents } from '@/server/agents';

export const dynamic = 'force-dynamic';

/** Whether AI assistance is on here, and the inventory of every agent this product runs. */
export async function GET() {
  const c = agents();
  return json({ enabled: c.enabled, reason: c.reason, inventory: AGENT_INVENTORY });
}

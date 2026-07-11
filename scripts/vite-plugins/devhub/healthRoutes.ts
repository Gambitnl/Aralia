import fs from 'fs';
import type { DevHubRouteContext } from './routeContext';

export async function handleHealthRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { req, json } = ctx;

  if (req.url === '/api/health/env') {
    json({ rDrive: fs.existsSync('R:\\AraliaV4\\Aralia') });
    return true;
  }

  return false;
}

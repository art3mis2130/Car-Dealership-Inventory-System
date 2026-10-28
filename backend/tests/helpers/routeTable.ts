import type { Express } from 'express';

interface ExpressLayer {
  name?: string;
  route?: { path?: string; methods?: Record<string, boolean> };
  handle?: { stack?: ExpressLayer[] };
  regexp?: RegExp & { fast_slash?: boolean };
}

/**
 * Lists the routes an Express app has actually registered, as
 * `"GET /api/vehicles/{id}"` strings.
 *
 * This exists so the OpenAPI document can be checked against reality rather
 * than against itself. Probing endpoints over HTTP does not work: every path
 * under /vehicles sits behind `authenticate`, so a request to a route that
 * does not exist still answers 401, and a drift check built that way passes
 * no matter what the spec claims. (It did, until this replaced it.)
 */
export function listRoutes(app: Express): string[] {
  const root = (app as unknown as { _router?: { stack?: ExpressLayer[] } })._router;
  const routes: string[] = [];

  walk(root?.stack ?? [], '', routes);

  return routes.sort();
}

function walk(stack: ExpressLayer[], prefix: string, out: string[]): void {
  for (const layer of stack) {
    if (layer.route?.path) {
      const path = normalise(prefix + layer.route.path);

      for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
        if (enabled && method !== '_all') out.push(`${method.toUpperCase()} ${path}`);
      }

      continue;
    }

    if (layer.handle?.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer), out);
    }
  }
}

/** Recovers the mount path a sub-router was attached at from its regexp. */
function mountPath(layer: ExpressLayer): string {
  if (!layer.regexp || layer.regexp.fast_slash) return '';

  // Express compiles `use('/api', ...)` to /^\/api\/?(?=\/|$)/
  const match = /^\^((?:\\\/[^\\?(]+)+)/.exec(layer.regexp.source);

  return match?.[1] ? match[1].replace(/\\\//g, '/') : '';
}

/** `/api/vehicles/:id` -> `/api/vehicles/{id}`, to match OpenAPI's notation. */
function normalise(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\/$/, '') || '/';
}

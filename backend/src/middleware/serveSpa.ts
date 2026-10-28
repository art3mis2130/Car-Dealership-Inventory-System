import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';

export interface SpaOptions {
  enabled: boolean;
  /** Where the built frontend lives, absolute or relative to the backend. */
  distPath: string;
}

/**
 * Single-service mode: the API also serves the built SPA.
 *
 * Hashed assets get a long cache lifetime, index.html gets none (or a deploy
 * would not be picked up), and any non-API path falls through to index.html
 * so client-side routes survive a refresh.
 *
 * Deliberately opt-in rather than "on if the folder happens to exist":
 * behaviour that changes depending on whether someone ran a build is how you
 * get a bug that only reproduces in one environment. The options are passed
 * in rather than read from the environment here, so this can be tested
 * against a temporary directory instead of only inside a container.
 */
export function serveSpa(app: Express, options: SpaOptions): void {
  if (!options.enabled) return;

  const distPath = resolveDistPath(options.distPath);

  if (!distPath) {
    console.warn(`SERVE_SPA is on but no built frontend was found at ${options.distPath}`);
    return;
  }

  // Hashed filenames, so the assets themselves can be cached hard.
  app.use(
    express.static(distPath, {
      index: false,
      maxAge: '1y',
      immutable: true,
    }),
  );

  /*
   * Every path except /api/* falls through to index.html. The negative
   * lookahead matters: without it a mistyped API route would return the HTML
   * page with a 200, and a client would try to parse a web page as JSON
   * instead of seeing a clean 404.
   */
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
    res.sendFile(
      join(distPath, 'index.html'),
      { headers: { 'Cache-Control': 'no-cache' } },
      (error) => {
        if (error) next();
      },
    );
  });
}

function resolveDistPath(configured: string): string | null {
  const here = dirname(fileURLToPath(import.meta.url));

  const candidates = [
    resolve(process.cwd(), configured),
    // From dist/middleware/ at runtime, or src/middleware/ under tsx.
    resolve(here, '../../', configured),
    resolve(here, '../../../', configured),
  ];

  return candidates.find((candidate) => existsSync(join(candidate, 'index.html'))) ?? null;
}

import { getEnv } from '../config/env.js';
import { openDatabase } from './index.js';

/**
 * `npm run migrate` - brings the configured database up to date.
 *
 * openDatabase() already migrates, so this script exists to make that
 * explicit (and scriptable in a deploy step) rather than a side effect of
 * booting the server.
 */
const env = getEnv();
const db = openDatabase(env.DATABASE_PATH);
const [{ user_version: version }] = db.pragma('user_version') as [{ user_version: number }];

console.log(`Database ready at ${env.DATABASE_PATH} (schema version ${version})`);
db.close();

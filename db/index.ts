import { drizzle } from "drizzle-orm/libsql";
import { databaseClient } from '../lib/database';
import * as schema from "./schema";

export function getDb() {
  return drizzle(databaseClient(), { schema });
}

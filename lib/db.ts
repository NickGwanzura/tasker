import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
export const hasDatabase = Boolean(url);

const sql = neon(
  url || "postgresql://placeholder:placeholder@ep-placeholder.us-east-1.aws.neon.tech/neondb?sslmode=require"
);
export const db = drizzle(sql, { schema });
export { schema };

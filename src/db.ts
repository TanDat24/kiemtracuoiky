import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";

const DB_NAME = "simple-contacts.db";
let databasePromise: Promise<SQLiteDatabase> | undefined;

// Lazily open the database and ensure the contacts table exists before usage.
export async function getDatabase(): Promise<SQLiteDatabase> {
    if (!databasePromise) {
        databasePromise = bootstrap();
    }
    return databasePromise;
}

async function bootstrap(): Promise<SQLiteDatabase> {
    const db = await openDatabaseAsync(DB_NAME);
    await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      favorite INTEGER DEFAULT 0,
      created_at INTEGER
    );
  `);
    return db;
}

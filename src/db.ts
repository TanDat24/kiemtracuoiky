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
    await seedInitialContacts(db);
    return db;
}

async function seedInitialContacts(db: SQLiteDatabase): Promise<void> {
    const existing = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM contacts"
    );
    if (existing && existing.count > 0) {
        return;
    }

    const samples = [
        { name: "Alice Nguyen", phone: "0901234567" },
        { name: "Bao Tran", phone: "0987654321" },
        { name: "Cuong Le", phone: "0912345678" },
    ];
    const now = Date.now();

    for (let index = 0; index < samples.length; index += 1) {
        const contact = samples[index];
        await db.runAsync(
            "INSERT INTO contacts (name, phone, email, favorite, created_at) VALUES (?, ?, ?, ?, ?)",
            contact.name,
            contact.phone,
            null,
            0,
            now + index
        );
    }
}

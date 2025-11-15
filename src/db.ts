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
    // NOTE: On web (OPFS) using WAL can trigger AccessHandle conflicts.
    // Keep a single statement per exec to reduce chance of race conditions.
    await db.execAsync(
        "CREATE TABLE IF NOT EXISTS contacts (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "name TEXT NOT NULL," +
            "phone TEXT," +
            "email TEXT," +
            "favorite INTEGER DEFAULT 0," +
            "created_at INTEGER" +
            ");"
    );
    await seedInitialContacts(db);
    await ensureDefaultFavorite(db);
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
        { name: "Alice Nguyen", phone: "0901234567", favorite: 1 },
        { name: "Bao Tran", phone: "0987654321", favorite: 0 },
        { name: "Cuong Le", phone: "0912345678", favorite: 0 },
    ];
    const now = Date.now();

    for (let index = 0; index < samples.length; index += 1) {
        const contact = samples[index];
        await db.runAsync(
            "INSERT INTO contacts (name, phone, email, favorite, created_at) VALUES (?, ?, ?, ?, ?)",
            contact.name,
            contact.phone,
            null,
            contact.favorite ?? 0,
            now + index
        );
    }
}

async function ensureDefaultFavorite(db: SQLiteDatabase): Promise<void> {
    const favorite = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM contacts WHERE favorite = 1 LIMIT 1"
    );
    if (favorite) {
        return;
    }

    const firstContact = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM contacts ORDER BY id ASC LIMIT 1"
    );
    if (!firstContact) {
        return;
    }

    await db.runAsync(
        "UPDATE contacts SET favorite = 1 WHERE id = ?",
        firstContact.id
    );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { getDatabase } from "../db";

export type Contact = {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    favorite: number;
    created_at: number | null;
};

interface UseContactsOptions {
    importUrl?: string; // Allow overriding API endpoint.
}

export function useContacts(options?: UseContactsOptions) {
    const importUrl =
        options?.importUrl ||
        "https://68e7cf9510e3f82fbf40d84d.mockapi.io/NguyenTanDat_22675131";

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importedCount, setImportedCount] = useState<number | null>(null);

    const loadContacts = useCallback(async (options?: { silent?: boolean }) => {
        if (!options?.silent) setLoading(true);
        setError(null);
        try {
            const db = await getDatabase();
            const rows = await db.getAllAsync<Contact>(
                "SELECT id, name, phone, email, favorite, created_at FROM contacts ORDER BY favorite DESC, name COLLATE NOCASE ASC"
            );
            setContacts(rows);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            if (!options?.silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    const addContact = useCallback(
        async (data: { name: string; phone?: string; email?: string }) => {
            const name = data.name.trim();
            const phone = data.phone?.trim() || null;
            const email = data.email?.trim() || null;
            const db = await getDatabase();
            await db.runAsync(
                "INSERT INTO contacts (name, phone, email, favorite, created_at) VALUES (?, ?, ?, ?, ?)",
                name,
                phone,
                email,
                0,
                Date.now()
            );
            await loadContacts({ silent: true });
        },
        [loadContacts]
    );

    const updateContact = useCallback(
        async (
            id: number,
            data: { name: string; phone?: string; email?: string }
        ) => {
            const name = data.name.trim();
            const phone = data.phone?.trim() || null;
            const email = data.email?.trim() || null;
            const db = await getDatabase();
            await db.runAsync(
                "UPDATE contacts SET name = ?, phone = ?, email = ? WHERE id = ?",
                name,
                phone,
                email,
                id
            );
            await loadContacts({ silent: true });
        },
        [loadContacts]
    );

    const deleteContact = useCallback(
        async (id: number) => {
            const db = await getDatabase();
            await db.runAsync("DELETE FROM contacts WHERE id = ?", id);
            await loadContacts({ silent: true });
        },
        [loadContacts]
    );

    const toggleFavorite = useCallback(
        async (contact: Contact) => {
            const nextFavorite = contact.favorite ? 0 : 1;
            const db = await getDatabase();
            await db.runAsync(
                "UPDATE contacts SET favorite = ? WHERE id = ?",
                nextFavorite,
                contact.id
            );
            await loadContacts({ silent: true });
        },
        [loadContacts]
    );

    const toggleFavoritesOnly = useCallback(
        () => setFavoritesOnly((prev) => !prev),
        []
    );

    const importFromApi = useCallback(async () => {
        if (importLoading) return;
        setImportLoading(true);
        setImportError(null);
        setImportedCount(null);
        try {
            const res = await fetch(importUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as Array<any>;
            const mapped = data.map((u) => ({
                name: u.name || "(No name)",
                phone: u.phone ? String(u.phone).replace(/\s+/g, "") : null,
                email: u.email || null,
            }));
            const db = await getDatabase();
            const existingRows = await db.getAllAsync<{ phone: string | null }>(
                "SELECT phone FROM contacts WHERE phone IS NOT NULL"
            );
            const existingPhones = new Set(
                existingRows
                    .map((r) => (r.phone ? r.phone.trim() : ""))
                    .filter((p) => p.length > 0)
            );
            let inserted = 0;
            for (const item of mapped) {
                if (!item.phone || existingPhones.has(item.phone.trim()))
                    continue;
                await db.runAsync(
                    "INSERT INTO contacts (name, phone, email, favorite, created_at) VALUES (?, ?, ?, ?, ?)",
                    item.name,
                    item.phone.trim(),
                    item.email,
                    0,
                    Date.now()
                );
                existingPhones.add(item.phone.trim());
                inserted++;
            }
            setImportedCount(inserted);
            await loadContacts({ silent: true });
        } catch (err) {
            setImportError((err as Error).message);
        } finally {
            setImportLoading(false);
        }
    }, [importLoading, importUrl, loadContacts]);

    const filteredContacts = useMemo(() => {
        const q = search.trim().toLowerCase();
        return contacts.filter((c) => {
            if (favoritesOnly && !c.favorite) return false;
            if (!q) return true;
            const nameMatch = c.name.toLowerCase().includes(q);
            const phoneMatch = (c.phone || "").toLowerCase().includes(q);
            return nameMatch || phoneMatch;
        });
    }, [contacts, search, favoritesOnly]);

    return {
        contacts,
        filteredContacts,
        loading,
        error,
        search,
        setSearch,
        favoritesOnly,
        toggleFavoritesOnly,
        loadContacts,
        addContact,
        updateContact,
        deleteContact,
        toggleFavorite,
        importFromApi,
        importLoading,
        importError,
        importedCount,
    };
}

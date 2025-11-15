import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

import { getDatabase } from "../db";

type Contact = {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    favorite: number;
    created_at: number | null;
};

export default function Page() {
    const { top, bottom } = useSafeAreaInsets();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function loadContacts() {
            try {
                const db = await getDatabase();
                const rows = await db.getAllAsync<Contact>(
                    "SELECT id, name, phone, email, favorite, created_at FROM contacts ORDER BY favorite DESC, name COLLATE NOCASE ASC"
                );
                if (isMounted) {
                    setContacts(rows);
                }
            } catch (err) {
                if (isMounted) {
                    setError((err as Error).message);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadContacts();
        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <View
            className="flex-1 bg-white"
            style={{ paddingTop: top, paddingBottom: bottom }}
        >
            <View className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <Text className="text-xl font-semibold text-gray-900">
                    Simple Contacts
                </Text>
                <Text className="text-sm text-gray-500">
                    Danh bạ cục bộ lưu trong SQLite
                </Text>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="small" />
                </View>
            ) : error ? (
                <View className="flex-1 items-center justify-center px-4">
                    <Text className="text-center text-red-500">
                        Không thể tải danh bạ: {error}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={contacts}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={
                        contacts.length === 0 ? { flex: 1 } : undefined
                    }
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center px-4">
                            <Text className="text-gray-500">
                                Chưa có liên hệ nào.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View className="px-4 py-3 border-b border-gray-100 flex-row justify-between items-center">
                            <View className="flex-1 pr-3">
                                <Text className="text-base font-medium text-gray-900">
                                    {item.name}
                                </Text>
                                {item.phone ? (
                                    <Text className="text-sm text-gray-600">
                                        Phone: {item.phone}
                                    </Text>
                                ) : null}
                                {item.email ? (
                                    <Text className="text-sm text-gray-600">
                                        Email: {item.email}
                                    </Text>
                                ) : null}
                            </View>
                            {item.favorite ? (
                                <MaterialIcons
                                    name="star"
                                    size={20}
                                    color="#f59e0b"
                                    accessibilityLabel="Favorite contact"
                                />
                            ) : null}
                        </View>
                    )}
                />
            )}
        </View>
    );
}

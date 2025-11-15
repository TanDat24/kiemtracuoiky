import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import {
    Button,
    FAB,
    HelperText,
    Modal,
    Portal,
    TextInput,
} from "react-native-paper";

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
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ name: "", phone: "", email: "" });
    const [formErrors, setFormErrors] = useState<{
        name?: string;
        email?: string;
        phone?: string;
        general?: string;
    }>({});

    const loadContacts = useCallback(async (options?: { silent?: boolean }) => {
        if (!options?.silent) {
            setLoading(true);
        }
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
            if (!options?.silent) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    function handleOpenModal() {
        setForm({ name: "", phone: "", email: "" });
        setFormErrors({});
        setIsModalVisible(true);
    }

    function handleDismissModal() {
        setIsModalVisible(false);
        setFormErrors({});
    }

    function updateField(field: "name" | "phone" | "email", value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
        setFormErrors((prev) => ({
            ...prev,
            [field]: undefined,
            general: undefined,
        }));
    }

    async function handleSubmit() {
        const trimmedName = form.name.trim();
        const trimmedPhone = form.phone.trim();
        const trimmedEmail = form.email.trim();

        const nextErrors: { name?: string; email?: string } = {};
        if (!trimmedName) {
            nextErrors.name = "Tên không được để trống.";
        }
        if (trimmedEmail && !trimmedEmail.includes("@")) {
            nextErrors.email = "Email không hợp lệ.";
        }
        if (Object.keys(nextErrors).length > 0) {
            setFormErrors((prev) => ({ ...prev, ...nextErrors }));
            return;
        }

        setSubmitting(true);
        setFormErrors({});
        try {
            const db = await getDatabase();
            await db.runAsync(
                "INSERT INTO contacts (name, phone, email, favorite, created_at) VALUES (?, ?, ?, ?, ?)",
                trimmedName,
                trimmedPhone.length > 0 ? trimmedPhone : null,
                trimmedEmail.length > 0 ? trimmedEmail : null,
                0,
                Date.now()
            );
            await loadContacts({ silent: true });
            handleDismissModal();
        } catch (err) {
            setFormErrors({
                general: (err as Error).message ?? "Không thể lưu liên hệ.",
            });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleToggleFavorite(contact: Contact) {
        const nextFavorite = contact.favorite ? 0 : 1;
        try {
            const db = await getDatabase();
            await db.runAsync(
                "UPDATE contacts SET favorite = ? WHERE id = ?",
                nextFavorite,
                contact.id
            );
            await loadContacts({ silent: true });
        } catch (err) {
            setError((err as Error).message);
        }
    }

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
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={
                                    item.favorite
                                        ? "Bỏ đánh dấu yêu thích"
                                        : "Đánh dấu yêu thích"
                                }
                                onPress={() => handleToggleFavorite(item)}
                                hitSlop={8}
                            >
                                <MaterialIcons
                                    name={
                                        item.favorite ? "star" : "star-outline"
                                    }
                                    size={22}
                                    color={
                                        item.favorite ? "#f59e0b" : "#9ca3af"
                                    }
                                />
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
            <Portal>
                <Modal
                    visible={isModalVisible}
                    onDismiss={handleDismissModal}
                    contentContainerStyle={styles.modalContent}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : undefined}
                    >
                        <Text style={styles.modalTitle}>Thêm liên hệ</Text>
                        <TextInput
                            label="Tên"
                            value={form.name}
                            onChangeText={(value) => updateField("name", value)}
                            mode="outlined"
                            autoFocus
                            error={!!formErrors.name}
                        />
                        <HelperText type="error" visible={!!formErrors.name}>
                            {formErrors.name}
                        </HelperText>

                        <TextInput
                            label="Số điện thoại"
                            value={form.phone}
                            onChangeText={(value) =>
                                updateField("phone", value)
                            }
                            mode="outlined"
                            keyboardType="phone-pad"
                            style={styles.inputSpacing}
                        />

                        <TextInput
                            label="Email"
                            value={form.email}
                            onChangeText={(value) =>
                                updateField("email", value)
                            }
                            mode="outlined"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            error={!!formErrors.email}
                            style={styles.inputSpacing}
                        />
                        <HelperText type="error" visible={!!formErrors.email}>
                            {formErrors.email}
                        </HelperText>

                        {formErrors.general ? (
                            <Text style={styles.generalError}>
                                {formErrors.general}
                            </Text>
                        ) : null}

                        <View style={styles.modalActions}>
                            <Button
                                onPress={handleDismissModal}
                                disabled={submitting}
                            >
                                Hủy
                            </Button>
                            <Button
                                mode="contained"
                                onPress={handleSubmit}
                                loading={submitting}
                                disabled={submitting}
                                style={styles.actionSpacing}
                            >
                                Lưu
                            </Button>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </Portal>
            <FAB
                icon="plus"
                label="Thêm"
                onPress={handleOpenModal}
                style={[styles.fab, { bottom: bottom + 24 }]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    modalContent: {
        marginHorizontal: 16,
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 12,
    },
    inputSpacing: {
        marginTop: 12,
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 16,
    },
    actionSpacing: {
        marginLeft: 12,
    },
    fab: {
        position: "absolute",
        right: 16,
    },
    generalError: {
        color: "#dc2626",
        marginTop: 4,
    },
});

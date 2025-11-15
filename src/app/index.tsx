import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
    IconButton,
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
    const [search, setSearch] = useState("");
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [formErrors, setFormErrors] = useState<{
        name?: string;
        email?: string;
        phone?: string;
        general?: string;
    }>({});
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
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

    function openCreateModal() {
        setEditingContact(null);
        setForm({ name: "", phone: "", email: "" });
        setFormErrors({});
        setIsModalVisible(true);
    }

    function openEditModal(contact: Contact) {
        setEditingContact(contact);
        setForm({
            name: contact.name ?? "",
            phone: contact.phone ?? "",
            email: contact.email ?? "",
        });
        setFormErrors({});
        setIsModalVisible(true);
    }

    function dismissModal() {
        setIsModalVisible(false);
        setEditingContact(null);
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
        if (!trimmedName) nextErrors.name = "Tên không được để trống.";
        if (trimmedEmail && !trimmedEmail.includes("@"))
            nextErrors.email = "Email không hợp lệ.";
        if (Object.keys(nextErrors).length) {
            setFormErrors((prev) => ({ ...prev, ...nextErrors }));
            return;
        }
        setSubmitting(true);
        setFormErrors({});
        try {
            const db = await getDatabase();
            if (editingContact) {
                await db.runAsync(
                    "UPDATE contacts SET name = ?, phone = ?, email = ? WHERE id = ?",
                    trimmedName,
                    trimmedPhone ? trimmedPhone : null,
                    trimmedEmail ? trimmedEmail : null,
                    editingContact.id
                );
            } else {
                await db.runAsync(
                    "INSERT INTO contacts (name, phone, email, favorite, created_at) VALUES (?, ?, ?, ?, ?)",
                    trimmedName,
                    trimmedPhone ? trimmedPhone : null,
                    trimmedEmail ? trimmedEmail : null,
                    0,
                    Date.now()
                );
            }
            await loadContacts({ silent: true });
            dismissModal();
        } catch (err) {
            setFormErrors({
                general: (err as Error).message || "Không thể lưu liên hệ.",
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
    const toggleFavoritesOnly = useCallback(() => {
        setFavoritesOnly((prev) => !prev);
    }, []);

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

    const importFromApi = useCallback(async () => {
        if (importLoading) return;
        setImportLoading(true);
        setImportError(null);
        setImportedCount(null);
        try {
            // Demo endpoint: JSONPlaceholder users ↔ map to contacts.
            const API_URL =
                "https://68e7cf9510e3f82fbf40d84d.mockapi.io/NguyenTanDat_22675131";
            const res = await fetch(API_URL);
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
                if (!item.phone || existingPhones.has(item.phone.trim())) {
                    continue; // skip duplicate or empty phone
                }
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
    }, [importLoading, loadContacts]);

    function handleConfirmDelete(contact: Contact) {
        Alert.alert("Xóa liên hệ", `Bạn có chắc muốn xóa "${contact.name}"?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa",
                style: "destructive",
                onPress: () => handleDelete(contact),
            },
        ]);
    }

    async function handleDelete(contact: Contact) {
        try {
            const db = await getDatabase();
            await db.runAsync("DELETE FROM contacts WHERE id = ?", contact.id);
            await loadContacts({ silent: true });
        } catch (err) {
            Alert.alert(
                "Lỗi",
                (err as Error).message || "Không thể xóa liên hệ."
            );
        }
    }

    return (
        <View
            className="flex-1 bg-white"
            style={{ paddingTop: top, paddingBottom: bottom }}
        >
            <View className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <View className="flex-row justify-between items-center mb-2">
                    <View style={{ flex: 1 }}>
                        <Text className="text-xl font-semibold text-gray-900">
                            Simple Contacts
                        </Text>
                        <Text className="text-sm text-gray-500">
                            Danh bạ cục bộ lưu trong SQLite
                        </Text>
                    </View>
                    <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                    >
                        <IconButton
                            icon={favoritesOnly ? "star" : "star-outline"}
                            size={22}
                            onPress={toggleFavoritesOnly}
                            accessibilityLabel={
                                favoritesOnly
                                    ? "Hiển thị tất cả"
                                    : "Chỉ xem yêu thích"
                            }
                            iconColor={favoritesOnly ? "#f59e0b" : undefined}
                        />
                        <Button
                            mode="outlined"
                            onPress={importFromApi}
                            loading={importLoading}
                            disabled={importLoading}
                        >
                            Import từ API
                        </Button>
                    </View>
                </View>
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Tìm theo tên hoặc số điện thoại"
                    mode="outlined"
                    left={<TextInput.Icon icon="magnify" />}
                    dense
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {importError ? (
                    <Text className="text-xs text-red-500 mt-1">
                        Lỗi import: {importError}
                    </Text>
                ) : importedCount !== null ? (
                    <Text className="text-xs text-green-600 mt-1">
                        Đã import {importedCount} liên hệ mới.
                    </Text>
                ) : null}
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
                    data={filteredContacts}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={
                        filteredContacts.length === 0 ? { flex: 1 } : undefined
                    }
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center px-4">
                            <Text className="text-gray-500">
                                {search.trim().length > 0
                                    ? "Không tìm thấy kết quả."
                                    : "Chưa có liên hệ nào."}
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View className="px-4 py-3 border-b border-gray-100 flex-row justify-between items-center">
                            <TouchableOpacity
                                style={styles.detailsZone}
                                activeOpacity={0.6}
                                onLongPress={() => openEditModal(item)}
                            >
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
                            </TouchableOpacity>
                            <View style={styles.rowActions}>
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
                                            item.favorite
                                                ? "star"
                                                : "star-outline"
                                        }
                                        size={22}
                                        color={
                                            item.favorite
                                                ? "#f59e0b"
                                                : "#9ca3af"
                                        }
                                    />
                                </TouchableOpacity>
                                <IconButton
                                    icon="pencil"
                                    size={18}
                                    onPress={() => openEditModal(item)}
                                    accessibilityLabel="Sửa liên hệ"
                                />
                                <IconButton
                                    icon="delete"
                                    size={18}
                                    onPress={() => handleConfirmDelete(item)}
                                    accessibilityLabel="Xóa liên hệ"
                                />
                            </View>
                        </View>
                    )}
                />
            )}
            <Portal>
                <Modal
                    visible={isModalVisible}
                    onDismiss={dismissModal}
                    contentContainerStyle={styles.modalContent}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : undefined}
                    >
                        <Text style={styles.modalTitle}>
                            {editingContact
                                ? "Chỉnh sửa liên hệ"
                                : "Thêm liên hệ"}
                        </Text>
                        <TextInput
                            label="Tên"
                            value={form.name}
                            onChangeText={(v) => updateField("name", v)}
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
                            onChangeText={(v) => updateField("phone", v)}
                            mode="outlined"
                            keyboardType="phone-pad"
                            style={styles.inputSpacing}
                        />
                        <TextInput
                            label="Email"
                            value={form.email}
                            onChangeText={(v) => updateField("email", v)}
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
                                onPress={dismissModal}
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
                onPress={openCreateModal}
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
    rowActions: {
        flexDirection: "row",
        alignItems: "center",
    },
    detailsZone: {
        flex: 1,
    },
});

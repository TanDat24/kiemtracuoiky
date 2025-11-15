import "../global.css";
import { Slot } from "expo-router";
import { useFonts } from "expo-font";
import { MaterialIcons } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";
import { useEffect } from "react";
import { PaperProvider } from "react-native-paper";

export default function Layout() {
    const [fontsLoaded, fontError] = useFonts(MaterialIcons.font);

    useEffect(() => {
        if (fontError) {
            throw fontError;
        }
    }, [fontError]);

    if (!fontsLoaded) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="small" />
            </View>
        );
    }

    return (
        <PaperProvider>
            <Slot />
        </PaperProvider>
    );
}

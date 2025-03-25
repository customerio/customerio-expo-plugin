import { Text, View, Button } from "react-native";
import { useEffect } from "react";
import { initialize, identifyUser, trackEvent, requestPushPermission } from "../services/customerIO";

export default function Index() {

  useEffect(() => {
    const initializeCustomerIO = async () => {
      try {
        await initialize();
        // Once the SDK is initialized, you can identify a user
        await identifyUser("expo-test-user@example.com", {
          first_name: "John",
          last_name: "Doe",
          email: "expo-test-user@example.com",
        });

        // Request push permission
        await requestPushPermission();
        
      } catch (error) {
        console.error("Error initializing CustomerIO:", error);
      }
    };
    initializeCustomerIO();
  }, []);

  const handleTrackEvent = async () => {
    try {
      await trackEvent("test-event", {});
    } catch (error) {
      console.error("Error tracking event:", error);
    }
  };

  return (
    <View>
      <Text>The CustomerIO SDK has been initialized</Text>
      <Text>The user has been identified: expo-test-user@example.com</Text>
      <Button title="Track Event" onPress={handleTrackEvent} />
    </View>
  );
}

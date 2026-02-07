import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 10 }}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: () => <TabIcon label="BLE" />,
        }}
      />
      <Tabs.Screen
        name="sensor"
        options={{
          title: 'Sensor',
          tabBarIcon: () => <TabIcon label="IMU" />,
        }}
      />
      <Tabs.Screen
        name="gestures"
        options={{
          title: 'Gestures',
          tabBarIcon: () => <TabIcon label="DTW" />,
        }}
      />
      <Tabs.Screen
        name="smart-home"
        options={{
          title: 'Home',
          tabBarIcon: () => <TabIcon label="HA" />,
        }}
      />
      <Tabs.Screen
        name="pipeline"
        options={{
          title: 'Pipeline',
          tabBarIcon: () => <TabIcon label="ALL" />,
        }}
      />
    </Tabs>
  );
}

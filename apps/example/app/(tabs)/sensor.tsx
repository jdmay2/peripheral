/**
 * Sensor Monitor screen.
 * Live IMU data visualization from a connected BLE device.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useDevice, useCharacteristic } from '@peripherals/ble-core';
import {
  useGestureEngine,
  useActivityContext,
  useSensorVisualization,
} from '@peripherals/gesture-engine';
import type { IMUSample } from '@peripherals/gesture-engine';
import { createIMU6AxisParser } from '@peripherals/integration';

const defaultParser = createIMU6AxisParser();

export default function SensorScreen() {
  const [deviceId, setDeviceId] = useState('');
  const [serviceUUID, setServiceUUID] = useState('');
  const [charUUID, setCharUUID] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sensor Monitor</Text>

      <TextInput
        style={styles.input}
        placeholder="Device ID"
        value={deviceId}
        onChangeText={setDeviceId}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Service UUID"
        value={serviceUUID}
        onChangeText={setServiceUUID}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="IMU Characteristic UUID"
        value={charUUID}
        onChangeText={setCharUUID}
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.button, isMonitoring && styles.buttonActive]}
        onPress={() => setIsMonitoring(!isMonitoring)}
        disabled={!deviceId || !serviceUUID || !charUUID}
      >
        <Text style={styles.buttonText}>
          {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
        </Text>
      </TouchableOpacity>

      {isMonitoring && deviceId && (
        <SensorMonitor
          deviceId={deviceId}
          serviceUUID={serviceUUID}
          charUUID={charUUID}
        />
      )}
    </ScrollView>
  );
}

function SensorMonitor({
  deviceId,
  serviceUUID,
  charUUID,
}: {
  deviceId: string;
  serviceUUID: string;
  charUUID: string;
}) {
  const { isConnected } = useDevice(deviceId);
  const { engine, start, stop } = useGestureEngine();
  const { activity } = useActivityContext(engine);
  const { samples } = useSensorVisualization(engine, { sampleCount: 100 });

  // Subscribe to IMU characteristic and feed to engine
  const { rawValue, isSubscribed } = useCharacteristic(
    deviceId,
    serviceUUID,
    charUUID,
    { autoSubscribe: true },
  );

  React.useEffect(() => {
    if (rawValue) {
      const parsed = defaultParser(rawValue, Date.now());
      if (parsed.length > 0) {
        engine.feedSamples(parsed);
      }
    }
  }, [rawValue, engine]);

  React.useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  if (!isConnected) {
    return (
      <View style={styles.card}>
        <Text style={styles.warning}>Device not connected. Connect from Scanner tab first.</Text>
      </View>
    );
  }

  const latest: IMUSample | null = samples.length > 0 ? samples[samples.length - 1]! : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Live IMU Data</Text>

      <Text style={styles.label}>Activity: {activity?.level ?? 'unknown'}</Text>

      {latest ? (
        <View style={styles.grid}>
          <AxisValue label="aX" value={latest.ax} color="#FF3B30" />
          <AxisValue label="aY" value={latest.ay} color="#34C759" />
          <AxisValue label="aZ" value={latest.az} color="#007AFF" />
          {latest.gx !== undefined && (
            <>
              <AxisValue label="gX" value={latest.gx} color="#FF9500" />
              <AxisValue label="gY" value={latest.gy!} color="#AF52DE" />
              <AxisValue label="gZ" value={latest.gz!} color="#5AC8FA" />
            </>
          )}
        </View>
      ) : (
        <Text style={styles.muted}>Waiting for data...</Text>
      )}

      <Text style={styles.sampleCount}>{samples.length} samples buffered</Text>
    </View>
  );
}

function AxisValue({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.axisItem}>
      <Text style={[styles.axisLabel, { color }]}>{label}</Text>
      <Text style={styles.axisValue}>{value.toFixed(3)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
    fontFamily: 'monospace',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonActive: { backgroundColor: '#FF3B30' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 14, color: '#333', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  axisItem: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  axisLabel: { fontSize: 12, fontWeight: '600' },
  axisValue: { fontSize: 16, fontFamily: 'monospace', marginTop: 2 },
  muted: { color: '#999', fontStyle: 'italic' },
  warning: { color: '#FF9500' },
  sampleCount: { color: '#888', fontSize: 12, marginTop: 8 },
});

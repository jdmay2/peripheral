/**
 * BLE Scanner screen.
 * Scan for BLE peripherals, view details, connect/disconnect.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  useBleManager,
  useScan,
  useDevice,
  matchProfiles,
} from '@peripheral/ble-core';
import type { ScanResult } from '@peripheral/ble-core';

export default function ScannerScreen() {
  const { isReady, error: bleError } = useBleManager();
  const { devices, isScanning, startScan, stopScan, clearDevices } = useScan();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.subtitle}>Initializing BLE...</Text>
        {bleError && <Text style={styles.error}>{bleError.message}</Text>}
      </View>
    );
  }

  const handleScan = async () => {
    if (isScanning) {
      await stopScan();
    } else {
      clearDevices();
      await startScan({ duration: 10000, allowDuplicates: false });
    }
  };

  const renderDevice = ({ item }: { item: ScanResult }) => {
    const profiles = matchProfiles(item.serviceUUIDs ?? []);
    const isSelected = selectedDeviceId === item.id;

    return (
      <TouchableOpacity
        style={[styles.deviceItem, isSelected && styles.deviceItemSelected]}
        onPress={() => setSelectedDeviceId(isSelected ? null : item.id)}
      >
        <Text style={styles.deviceName}>{item.name ?? 'Unknown Device'}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
        <View style={styles.row}>
          <Text style={styles.rssi}>RSSI: {item.rssi} dBm</Text>
          {profiles.length > 0 && (
            <Text style={styles.profiles}>
              {profiles.map((p) => p.name).join(', ')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isScanning && styles.buttonActive]}
        onPress={handleScan}
      >
        <Text style={styles.buttonText}>
          {isScanning ? 'Stop Scan' : 'Start Scan'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.count}>{devices.length} devices found</Text>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDevice}
        style={styles.list}
      />

      {selectedDeviceId && (
        <DeviceDetail deviceId={selectedDeviceId} />
      )}
    </View>
  );
}

function DeviceDetail({ deviceId }: { deviceId: string }) {
  const { device, connect, disconnect, isConnected, isConnecting, error } =
    useDevice(deviceId);

  return (
    <View style={styles.detail}>
      <Text style={styles.detailTitle}>{device?.name ?? deviceId}</Text>
      <Text style={styles.detailState}>
        {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
      </Text>
      {device && (
        <Text style={styles.detailInfo}>
          MTU: {device.mtu} | Services: {device.services.length}
        </Text>
      )}
      {error && <Text style={styles.error}>{error.message}</Text>}
      <TouchableOpacity
        style={[styles.button, isConnected && styles.buttonDanger]}
        onPress={() =>
          isConnected ? disconnect() : connect({ autoReconnect: true })
        }
      >
        <Text style={styles.buttonText}>
          {isConnected ? 'Disconnect' : 'Connect'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonActive: { backgroundColor: '#FF3B30' },
  buttonDanger: { backgroundColor: '#FF3B30' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  count: { textAlign: 'center', marginVertical: 8, color: '#666' },
  list: { flex: 1 },
  deviceItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  deviceItemSelected: { borderColor: '#007AFF', borderWidth: 2 },
  deviceName: { fontSize: 16, fontWeight: '600' },
  deviceId: { fontSize: 12, color: '#888', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rssi: { fontSize: 12, color: '#666' },
  profiles: { fontSize: 12, color: '#007AFF' },
  subtitle: { marginTop: 8, color: '#666' },
  error: { color: '#FF3B30', marginTop: 4, fontSize: 13 },
  detail: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  detailTitle: { fontSize: 18, fontWeight: '600' },
  detailState: { fontSize: 14, color: '#666', marginTop: 4 },
  detailInfo: { fontSize: 12, color: '#888', marginTop: 4 },
});

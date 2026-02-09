/**
 * Pipeline Demo screen.
 * Full BLE -> gesture -> smart home pipeline via useIMUGestureControl.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useIMUGestureControl } from '@peripherals/integration';
import type { GestureActionMap } from '@peripherals/integration';
import { EngineState } from '@peripherals/gesture-engine';
import { toggle } from '@peripherals/smart-home';

export default function PipelineScreen() {
  const [deviceId, setDeviceId] = useState('');
  const [serviceUUID, setServiceUUID] = useState('');
  const [charUUID, setCharUUID] = useState('');
  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [entityId, setEntityId] = useState('light.living_room');
  const [isActive, setIsActive] = useState(false);

  const actionMap: GestureActionMap = {
    shake: toggle(entityId),
    tap: toggle(entityId),
  };

  if (!isActive) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Pipeline Demo</Text>
        <Text style={styles.subtitle}>BLE sensor -&gt; gesture -&gt; smart home action</Text>

        <Text style={styles.sectionLabel}>BLE Configuration</Text>
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

        <Text style={styles.sectionLabel}>Home Assistant</Text>
        <TextInput
          style={styles.input}
          placeholder="HA URL (http://192.168.1.100:8123)"
          value={haUrl}
          onChangeText={setHaUrl}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Long-lived token"
          value={haToken}
          onChangeText={setHaToken}
          autoCapitalize="none"
          secureTextEntry
        />

        <Text style={styles.sectionLabel}>Action Target</Text>
        <TextInput
          style={styles.input}
          placeholder="Entity ID (e.g., light.living_room)"
          value={entityId}
          onChangeText={setEntityId}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={() => setIsActive(true)}
          disabled={!deviceId || !serviceUUID || !charUUID}
        >
          <Text style={styles.buttonText}>Start Pipeline</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <PipelineDashboard
      deviceId={deviceId}
      serviceUUID={serviceUUID}
      charUUID={charUUID}
      haUrl={haUrl}
      haToken={haToken}
      actionMap={actionMap}
      onStop={() => setIsActive(false)}
    />
  );
}

function PipelineDashboard({
  deviceId,
  serviceUUID,
  charUUID,
  haUrl,
  haToken,
  actionMap,
  onStop,
}: {
  deviceId: string;
  serviceUUID: string;
  charUUID: string;
  haUrl: string;
  haToken: string;
  actionMap: GestureActionMap;
  onStop: () => void;
}) {
  const {
    pipelineStatus,
    bridgeStatus,
    engineState,
    isDeviceConnected,
    isHAConnected,
    lastGesture,
    lastAction,
    start,
    stop,
    error,
  } = useIMUGestureControl({
    deviceId,
    serviceUUID,
    characteristicUUID: charUUID,
    actionMap,
    haConfig: haUrl
      ? { url: haUrl, auth: { type: 'longLivedToken', token: haToken } }
      : undefined,
  });

  React.useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);
  const isEngineActive =
    engineState === EngineState.Listening || engineState === EngineState.Armed;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pipeline Active</Text>
        <TouchableOpacity onPress={onStop}>
          <Text style={styles.stopBtn}>Stop</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error.message}</Text>}

      {/* Status grid */}
      <View style={styles.grid}>
        <StatusCard
          title="BLE"
          status={isDeviceConnected ? 'connected' : 'disconnected'}
          detail={`Subscribed: ${pipelineStatus.isSubscribed ? 'yes' : 'no'}`}
          metric={`${pipelineStatus.totalSamplesForwarded} samples`}
        />
        <StatusCard
          title="Engine"
          status={isEngineActive ? 'active' : engineState}
          detail={lastGesture ? `Last: ${lastGesture.gestureName ?? lastGesture.gestureId}` : 'Waiting...'}
          metric={lastGesture ? `${(lastGesture.confidence * 100).toFixed(0)}% conf` : ''}
        />
        <StatusCard
          title="Home"
          status={isHAConnected ? 'connected' : haUrl ? 'disconnected' : 'not configured'}
          detail={lastAction ? `Last: ${lastAction.serviceCall.domain}.${lastAction.serviceCall.service}` : 'No actions yet'}
          metric={`${bridgeStatus.actionsExecuted} executed, ${bridgeStatus.actionsSkipped} skipped`}
        />
      </View>

      {/* Pipeline flow visualization */}
      <View style={styles.flowSection}>
        <Text style={styles.sectionLabel}>Pipeline Flow</Text>
        <FlowStep
          label="1. BLE Notification"
          active={pipelineStatus.isSubscribed}
          value={pipelineStatus.totalSamplesForwarded > 0 ? 'Receiving data' : 'Waiting'}
        />
        <Text style={styles.arrow}>  ↓</Text>
        <FlowStep
          label="2. Gesture Recognition"
          active={isEngineActive}
          value={lastGesture?.gestureName ?? 'No gesture'}
        />
        <Text style={styles.arrow}>  ↓</Text>
        <FlowStep
          label="3. Smart Home Action"
          active={bridgeStatus.actionsExecuted > 0}
          value={lastAction ? `${lastAction.serviceCall.domain}.${lastAction.serviceCall.service}` : 'Waiting for gesture'}
        />
      </View>
    </ScrollView>
  );
}

function StatusCard({
  title,
  status,
  detail,
  metric,
}: {
  title: string;
  status: string;
  detail: string;
  metric: string;
}) {
  const isGood = status === 'connected' || status === 'active';
  return (
    <View style={styles.statusCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.cardStatus, isGood ? styles.green : styles.gray]}>{status}</Text>
      <Text style={styles.cardDetail}>{detail}</Text>
      <Text style={styles.cardMetric}>{metric}</Text>
    </View>
  );
}

function FlowStep({
  label,
  active,
  value,
}: {
  label: string;
  active: boolean;
  value: string;
}) {
  return (
    <View style={[styles.flowStep, active && styles.flowStepActive]}>
      <Text style={styles.flowLabel}>{label}</Text>
      <Text style={styles.flowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#666', marginBottom: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 4, color: '#333' },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  stopBtn: { color: '#FF3B30', fontWeight: '600', fontSize: 16 },
  error: { color: '#FF3B30', marginBottom: 8 },
  grid: { gap: 8, marginTop: 12 },
  statusCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  cardStatus: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  green: { color: '#34C759' },
  gray: { color: '#888' },
  cardDetail: { fontSize: 13, color: '#666', marginTop: 4 },
  cardMetric: { fontSize: 11, color: '#aaa', marginTop: 2 },
  flowSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  flowStep: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ddd',
  },
  flowStepActive: { borderLeftColor: '#34C759', backgroundColor: '#F0FFF4' },
  flowLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
  flowValue: { fontSize: 12, color: '#666', marginTop: 2 },
  arrow: { fontSize: 16, color: '#ccc', marginVertical: 2 },
});

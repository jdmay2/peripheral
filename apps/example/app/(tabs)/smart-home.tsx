/**
 * Smart Home screen.
 * Connect to Home Assistant, browse entities, control devices.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  useHomeAssistant,
  useEntities,
  useService,
  useAreas,
  toggle,
} from '@peripherals/smart-home';
import type { SmartHomeEntity } from '@peripherals/smart-home';

export default function SmartHomeScreen() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  if (!isConfigured) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Smart Home</Text>

        <Text style={styles.label}>Home Assistant URL</Text>
        <TextInput
          style={styles.input}
          placeholder="http://192.168.1.100:8123"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.label}>Long-Lived Access Token</Text>
        <TextInput
          style={styles.input}
          placeholder="eyJ..."
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={() => setIsConfigured(true)}
          disabled={!url || !token}
        >
          <Text style={styles.buttonText}>Connect</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <HADashboard
      url={url}
      token={token}
      onDisconnect={() => setIsConfigured(false)}
    />
  );
}

function HADashboard({
  url,
  token,
  onDisconnect,
}: {
  url: string;
  token: string;
  onDisconnect: () => void;
}) {
  const { client, isConnected, error } = useHomeAssistant({
    url,
    auth: { type: 'longLivedToken', token },
  });
  const { entities } = useEntities(client);
  const { areas } = useAreas(client);
  const { callService, isLoading } = useService(client);

  const [domainFilter, setDomainFilter] = useState<string>('');

  const filteredEntities = entities.filter((e) => {
    if (!domainFilter) return true;
    return e.entityId.startsWith(domainFilter + '.');
  });

  const handleToggle = async (entity: SmartHomeEntity) => {
    const call = toggle(entity.entityId);
    await callService(call.domain, call.service, {
      target: call.target,
    });
  };

  const domains = [...new Set(entities.map((e) => e.entityId.split('.')[0]))].sort();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Smart Home</Text>
        <TouchableOpacity onPress={onDisconnect}>
          <Text style={styles.disconnectBtn}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBar}>
        <Text style={[styles.status, isConnected ? styles.connected : styles.disconnected]}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        <Text style={styles.count}>
          {entities.length} entities | {areas.length} areas
        </Text>
      </View>

      {error && <Text style={styles.error}>{error.message}</Text>}

      {/* Domain filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, !domainFilter && styles.chipActive]}
          onPress={() => setDomainFilter('')}
        >
          <Text style={[styles.chipText, !domainFilter && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {domains.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, domainFilter === d && styles.chipActive]}
            onPress={() => setDomainFilter(domainFilter === d ? '' : d!)}
          >
            <Text style={[styles.chipText, domainFilter === d && styles.chipTextActive]}>
              {d}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Entity list */}
      <FlatList
        data={filteredEntities.slice(0, 50)}
        keyExtractor={(e) => e.entityId}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.entityItem} onPress={() => handleToggle(item)}>
            <View style={styles.entityInfo}>
              <Text style={styles.entityName}>
                {item.friendlyName || item.entityId}
              </Text>
              <Text style={styles.entityId}>{item.entityId}</Text>
            </View>
            <View
              style={[
                styles.stateBadge,
                item.state === 'on' || item.state === 'home'
                  ? styles.stateOn
                  : styles.stateOff,
              ]}
            >
              <Text style={styles.stateText}>{item.state}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      {filteredEntities.length > 50 && (
        <Text style={styles.muted}>Showing first 50 of {filteredEntities.length}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4, color: '#333' },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  disconnectBtn: { color: '#FF3B30', fontWeight: '600' },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  status: { fontWeight: '600', fontSize: 14 },
  connected: { color: '#34C759' },
  disconnected: { color: '#FF3B30' },
  count: { color: '#888', fontSize: 12 },
  error: { color: '#FF3B30', marginBottom: 8 },
  chips: { marginBottom: 12, flexGrow: 0 },
  chip: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
  entityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  entityInfo: { flex: 1 },
  entityName: { fontSize: 14, fontWeight: '500' },
  entityId: { fontSize: 11, color: '#888', marginTop: 1 },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  stateOn: { backgroundColor: '#E8F5E9' },
  stateOff: { backgroundColor: '#F5F5F5' },
  stateText: { fontSize: 12, fontWeight: '500' },
  muted: { color: '#999', textAlign: 'center', marginTop: 8 },
});

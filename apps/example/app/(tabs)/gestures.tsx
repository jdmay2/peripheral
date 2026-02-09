/**
 * Gesture Lab screen.
 * Record DTW gestures, test recognition, manage gesture library.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  useGestureEngine,
  useGestureRecognition,
  useGestureRecorder,
  useGestureLibrary,
} from '@peripherals/gesture-engine';
import type { RecognitionResult } from '@peripherals/gesture-engine';

export default function GesturesScreen() {
  const { engine, start, stop } = useGestureEngine();
  const recognition = useGestureRecognition(engine);
  const recorder = useGestureRecorder(engine);
  const library = useGestureLibrary(engine);

  const [gestureName, setGestureName] = useState('');
  const [isListening, setIsListening] = useState(false);

  const handleToggleListening = () => {
    if (isListening) {
      stop();
    } else {
      start();
    }
    setIsListening(!isListening);
  };

  const handleStartRecording = () => {
    if (!gestureName.trim()) return;
    const id = gestureName.trim().toLowerCase().replace(/\s+/g, '-');
    recorder.startSession(id, gestureName.trim());
  };

  const renderResult = ({ item }: { item: RecognitionResult }) => (
    <View style={[styles.resultItem, item.accepted ? styles.accepted : styles.rejected]}>
      <Text style={styles.resultName}>{item.gestureName ?? item.gestureId}</Text>
      <Text style={styles.resultConf}>
        {(item.confidence * 100).toFixed(0)}%{' '}
        {item.accepted ? 'accepted' : `rejected: ${item.rejectionReason ?? 'unknown'}`}
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Gesture Lab</Text>

      {/* Recognition */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recognition</Text>
        <TouchableOpacity
          style={[styles.button, isListening && styles.buttonActive]}
          onPress={handleToggleListening}
        >
          <Text style={styles.buttonText}>
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Text>
        </TouchableOpacity>

        {recognition.allResults.length > 0 ? (
          <FlatList
            data={recognition.allResults.slice(0, 10)}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderResult}
            scrollEnabled={false}
            style={styles.resultList}
          />
        ) : (
          <Text style={styles.muted}>No gestures detected yet</Text>
        )}
      </View>

      {/* Recording */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Record New Gesture</Text>
        <TextInput
          style={styles.input}
          placeholder="Gesture name"
          value={gestureName}
          onChangeText={setGestureName}
        />

        {recorder.phase === 'idle' ? (
          <TouchableOpacity
            style={styles.button}
            onPress={handleStartRecording}
            disabled={!gestureName.trim()}
          >
            <Text style={styles.buttonText}>Start Recording Session</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.recordingStatus}>
            <Text style={styles.phase}>Phase: {recorder.phase}</Text>
            {recorder.phase === 'countdown' && (
              <Text style={styles.countdown}>Get ready...</Text>
            )}
            {recorder.phase === 'recording' && (
              <Text style={styles.recording}>Perform the gesture now!</Text>
            )}
            {recorder.session && (
              <Text style={styles.repCount}>
                Repetitions: {recorder.session.currentIndex} / {recorder.session.targetCount}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger]}
              onPress={recorder.stopSession}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Library */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Gesture Library ({library.gestures.length})
        </Text>
        {library.gestures.map((g) => (
          <View key={g.id} style={styles.libraryItem}>
            <View>
              <Text style={styles.gestureName}>{g.name}</Text>
              <Text style={styles.gestureInfo}>
                {g.classifier ?? 'auto'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => library.removeGesture(g.id)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
        {library.gestures.length === 0 && (
          <Text style={styles.muted}>No gestures recorded yet</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 4,
  },
  buttonActive: { backgroundColor: '#FF3B30' },
  buttonDanger: { backgroundColor: '#FF3B30' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
    fontSize: 16,
  },
  resultList: { marginTop: 8 },
  resultItem: {
    padding: 10,
    borderRadius: 6,
    marginBottom: 4,
  },
  accepted: { backgroundColor: '#E8F5E9' },
  rejected: { backgroundColor: '#FFF3E0' },
  resultName: { fontWeight: '600', fontSize: 14 },
  resultConf: { fontSize: 12, color: '#666', marginTop: 2 },
  muted: { color: '#999', fontStyle: 'italic', marginTop: 4 },
  recordingStatus: { marginTop: 8 },
  phase: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  countdown: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: '#FF9500' },
  recording: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#34C759' },
  repCount: { fontSize: 14, color: '#666', marginVertical: 4 },
  libraryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 4,
  },
  gestureName: { fontSize: 16, fontWeight: '500' },
  gestureInfo: { fontSize: 12, color: '#888' },
  removeBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
});

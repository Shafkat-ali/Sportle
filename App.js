import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const API_BASE = 'https://sportle-production.up.railway.app';

export default function App() {
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    fetch(`${API_BASE}/`)
      .then(r => r.json())
      .then(data => setStatus(`Connected: ${data.app} is ${data.status}`))
      .catch(() => setStatus('Connection failed'));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sportle</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  status: {
    fontSize: 16,
    color: '#666',
  },
});
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSettings, saveSettings, getUsername, setUsername, Settings } from '../src/services/api';

export default function SettingsScreen() {
  const [settings, setSettingsState] = useState<Settings>({
    soundEnabled: true,
    vibrationEnabled: true,
  });
  const [username, setUsernameState] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettingsState(s);
    const name = await getUsername();
    if (name) {
      setUsernameState(name);
      setNewUsername(name);
    }
  };

  const updateSetting = async (key: keyof Settings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettingsState(newSettings);
    await saveSettings(newSettings);
  };

  const handleSaveUsername = async () => {
    const trimmed = newUsername.trim();
    if (trimmed.length < 2) {
      Alert.alert('Hata', 'En az 2 karakter girin');
      return;
    }
    if (trimmed.length > 20) {
      Alert.alert('Hata', 'En fazla 20 karakter');
      return;
    }
    await setUsername(trimmed);
    setUsernameState(trimmed);
    setEditingUsername(false);
    Alert.alert('Başarılı', 'Kullanıcı adı güncellendi');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Username Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kullanıcı Adı</Text>
          {editingUsername ? (
            <View style={styles.usernameEdit}>
              <TextInput
                style={styles.usernameInput}
                value={newUsername}
                onChangeText={setNewUsername}
                maxLength={20}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveUsername}>
                <Ionicons name="checkmark" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditingUsername(false);
                  setNewUsername(username);
                }}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setEditingUsername(true)}
            >
              <View style={styles.settingInfo}>
                <Ionicons name="person" size={24} color="#009688" />
                <Text style={styles.settingText}>{username}</Text>
              </View>
              <Ionicons name="pencil" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Sound & Vibration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Oyun Ayarları</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high" size={24} color="#009688" />
              <Text style={styles.settingText}>Ses</Text>
            </View>
            <Switch
              value={settings.soundEnabled}
              onValueChange={(v) => updateSetting('soundEnabled', v)}
              trackColor={{ false: '#444', true: '#009688' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="phone-portrait" size={24} color="#009688" />
              <Text style={styles.settingText}>Titreşim</Text>
            </View>
            <Switch
              value={settings.vibrationEnabled}
              onValueChange={(v) => updateSetting('vibrationEnabled', v)}
              trackColor={{ false: '#444', true: '#009688' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diğer</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => Linking.openURL('mailto:busegame50@gmail.com')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="mail" size={24} color="#009688" />
              <Text style={styles.settingText}>İletişim</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingRow}
            onPress={() => Linking.openURL('https://busegame.com/gizlilik-politikasi')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="document-text" size={24} color="#009688" />
              <Text style={styles.settingText}>Gizlilik Politikası</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Versiyon 1.0.7</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#fff',
  },
  usernameEdit: {
    flexDirection: 'row',
    gap: 8,
  },
  usernameInput: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#009688',
  },
  saveButton: {
    backgroundColor: '#009688',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#666',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
  },
  version: {
    textAlign: 'center',
    color: '#666',
    marginTop: 'auto',
    paddingBottom: 20,
  },
});

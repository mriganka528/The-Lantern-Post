import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { PushSettings } from '@lantern-post/shared-types';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import { StoryButton, s } from '../storybook/story-ui';
import { serif, ink } from '../storybook/theme';
import { StoryIcon } from '../storybook/ornaments';
import { pushDriver } from './push-driver';
import { notifyPushChange, readPush, removePush, writePush } from './push-storage';
import { PalaceAlertSettings } from '../realtime/palace-alert-settings';
import { ensureWelcome, welcomeAvailable } from './welcome-driver';

export async function disableDevicePush(ownerId: string, getToken: GetSessionToken) {
  if (!ownerId || !pushDriver.available()) return;
  const record = await readPush(ownerId);
  if (record) await apiRequest('/notifications/unregister', getToken, { method: 'POST', body: { token: record.token } });
  await removePush(ownerId); notifyPushChange();
}
export function NotificationSettings({ ownerId, getToken, compact = false }: { ownerId: string; getToken: GetSessionToken; compact?: boolean }) {
  const [welcomeStatus, setWelcomeStatus] = useState<string | null>(null);
  const [welcoming, setWelcoming] = useState(false);
  const [enabled, setEnabled] = useState(false); const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true; let active = true;
    if (pushDriver.available()) void Promise.all([readPush(ownerId), apiRequest<PushSettings>('/notifications/settings', getToken)]).then(([saved, settings]) => {
      if (active) { setEnabled(Boolean(saved)); setAvailable(settings.enabled); }
    }).catch(() => { if (active) setError('The palace bells could not be checked. Reopen the court to try again.'); });
    return () => { active = false; mounted.current = false; };
  }, [getToken, ownerId]);
  async function toggle() {
    if (busy) return; setBusy(true); setError(null);
    try {
      if (enabled) { await disableDevicePush(ownerId, getToken); if (mounted.current) setEnabled(false); }
      else {
        const token = await pushDriver.token(true);
        if (!mounted.current) return;
        await apiRequest('/notifications/register', getToken, { method: 'POST', body: { token, platform: Platform.OS } });
        if (!mounted.current) { await apiRequest('/notifications/unregister', getToken, { method: 'POST', body: { token } }); return; }
        await writePush({ ownerId, token }); notifyPushChange(); setEnabled(true);
      }
    } catch { if (mounted.current) setError('Device alerts could not be changed. Check notification permission in your device settings and try again.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <View style={[styles.panel, compact && { marginTop: 0, borderTopWidth: 0, paddingTop: 0, alignItems: 'stretch' }]}><View style={styles.heading}><StoryIcon kind="bell" size={21} /><Text style={styles.title}>The palace bells</Text></View>
    <PalaceAlertSettings ownerId={ownerId}/>
    {welcomeAvailable() && <><StoryButton label={welcoming ? 'Ringing the welcome bell…' : 'Receive my welcome note'} secondary disabled={welcoming} onPress={() => {
      setWelcoming(true); void ensureWelcome(true).then(result => setWelcomeStatus(result === 'complete' ? 'Your welcome note has been sent to this phone’s notifications. It is sent only once.' : 'Allow notifications in your phone settings to receive your welcome note.')).catch(() => setWelcomeStatus('The welcome note could not be prepared. Please try again.')).finally(() => setWelcoming(false));
    }} />{welcomeStatus && <Text accessibilityLiveRegion="polite" style={s.body}>{welcomeStatus}</Text>}</>}
    <Text style={s.body}>{available ? 'Phone notifications for messages, letters and invitations, even when you leave the app. Enable them when you choose.' : Platform.OS==='web'?'Arrival notices work while this browser tab is open. Phone push can be enabled later in an installed Android app.':'Phone push needs an installed development or release build with notification setup. In-app arrival notices work now.'}</Text>
    {available && <StoryButton label={busy ? 'Tending the bells…' : enabled ? 'Turn off device alerts' : 'Enable device alerts'} onPress={() => { void toggle(); }} disabled={busy} secondary={enabled} />}
    {error && <Text role="alert" style={styles.error}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({ panel: { marginTop: 30, borderTopWidth: 1, borderColor: '#D3C19C', paddingTop: 21, gap: 13, alignItems: 'flex-start' }, heading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { fontFamily: serif, color: ink, fontSize: 22 }, error: { color: '#874F3E', fontSize: 12, lineHeight: 21 } });

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

export async function disableDevicePush(ownerId: string, getToken: GetSessionToken) {
  if (!ownerId || !pushDriver.available()) return;
  const record = await readPush(ownerId);
  if (record) await apiRequest('/notifications/unregister', getToken, { method: 'POST', body: { token: record.token } });
  await removePush(ownerId); notifyPushChange();
}
export function NotificationSettings({ ownerId, getToken }: { ownerId: string; getToken: GetSessionToken }) {
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
  return <View style={styles.panel}><View style={styles.heading}><StoryIcon kind="key" size={23} /><Text style={styles.title}>The palace bells</Text></View>
    <Text style={s.body}>{available ? 'A gentle notice when an invitation arrives or a new friendship opens. Only when you choose.' : 'Your invitations will be waiting here whenever you return. Device alerts are not available in this version.'}</Text>
    {available && <StoryButton label={busy ? 'Tending the bells…' : enabled ? 'Turn off device alerts' : 'Enable device alerts'} onPress={() => { void toggle(); }} disabled={busy} secondary={enabled} />}
    {error && <Text role="alert" style={styles.error}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({ panel: { marginTop: 30, borderTopWidth: 1, borderColor: '#D3C19C', paddingTop: 21, gap: 13, alignItems: 'flex-start' }, heading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { fontFamily: serif, color: ink, fontSize: 22 }, error: { color: '#874F3E', fontSize: 12, lineHeight: 21 } });

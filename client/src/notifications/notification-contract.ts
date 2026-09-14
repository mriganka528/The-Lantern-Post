export interface SavedPush { ownerId: string; token: string; }
export function parseSavedPush(value: string | null, ownerId: string): SavedPush | null {
  try {
    const parsed: unknown = value ? JSON.parse(value) : null;
    if (!parsed || typeof parsed !== 'object' || !('ownerId' in parsed) || parsed.ownerId !== ownerId || !('token' in parsed) || typeof parsed.token !== 'string' || !/^(ExponentPushToken|ExpoPushToken)\[[a-zA-Z0-9_-]+\]$/.test(parsed.token)) return null;
    return { ownerId, token: parsed.token };
  } catch { return null; }
}
export function friendNotificationEvent(data: unknown, ownerId: string): string | null {
  if (!data || typeof data !== 'object' || !('ownerId' in data) || data.ownerId !== ownerId || !('screen' in data) || data.screen !== 'friends' || !('type' in data) || !['FRIEND_REQUEST', 'FRIEND_ACCEPTED'].includes(String(data.type)) || !('eventId' in data) || typeof data.eventId !== 'string' || data.eventId.length > 150 || !data.eventId) return null;
  return data.eventId;
}
export type NotificationDestination=({screen:'friends'|'inbox'}|{screen:'chat';peerId:string})&{eventId:string};
export function notificationDestination(data: unknown, ownerId: string): NotificationDestination | null {
  const friendEvent = friendNotificationEvent(data, ownerId);
  if (friendEvent) return { eventId: friendEvent, screen: 'friends' };
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if(d.ownerId===ownerId&&d.type==='CHAT_MESSAGE'&&d.screen==='chat'&&typeof d.eventId==='string'&&d.eventId.length>0&&d.eventId.length<=180&&typeof d.peerId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(d.peerId)&&typeof d.messageId==='string'&&/^chatmsg_[a-f0-9-]{36}$/.test(d.messageId))return {eventId:d.eventId,screen:'chat',peerId:d.peerId};
  if (d.ownerId !== ownerId || d.type !== 'LETTER_DELIVERED' || d.screen !== 'inbox' || typeof d.eventId !== 'string' || !d.eventId || d.eventId.length > 150 || typeof d.letterId !== 'string' || !/^delivery_[a-f0-9]{64}$/.test(d.letterId)) return null;
  return { eventId: d.eventId, screen: 'inbox' };
}

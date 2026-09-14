import type { ChatCapabilities, ChatMessage, ChatPage, ChatReceipt, ChatSendRequest, FriendPerson, LetterReportReceipt, LetterReportRequest } from '@lantern-post/shared-types';
import { CHARACTER_KEYS } from '../storybook/character-keys';
export const CHAT_LIMIT = 2000;
export const validMessage = (text: string) => Boolean(text.trim()) && Array.from(text).length <= CHAT_LIMIT;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const validChatRequestId = (id: string) => uuid.test(id);
export class ChatFault extends Error { constructor(readonly kind: 'closed' | 'session' | 'throttled' | 'moderation' | 'connection') { super(kind); } }
export function chatProblem(error: unknown) {
  if (error instanceof ChatFault) {
    if (error.kind === 'closed') return 'This friendship gate is closed. Your unsent words are still kept here.';
    if (error.kind === 'session') return 'Please sign in again to return to the parlour.';
    if (error.kind === 'throttled') return 'Let the palace post rest a little before trying again.';
    if (error.kind === 'moderation') return 'Live chat is resting. Your words have not been sent.';
  }
  return 'The connection is resting. Your unsent words are kept on this device.';
}
export interface ChatTransport {
  open?(peerId: string, signal: AbortSignal, after?: number): Promise<ChatPage>;
  capabilities(signal?: AbortSignal): Promise<ChatCapabilities>;
  history(peerId: string, before?: number, signal?: AbortSignal): Promise<ChatPage>;
  poll(peerId: string, after: number, signal?: AbortSignal): Promise<ChatPage>;
  send(peerId: string, input: ChatSendRequest, signal?: AbortSignal): Promise<ChatReceipt>;
  receipt(peerId: string, requestId: string, signal?: AbortSignal): Promise<ChatReceipt | null>;
  cancel(peerId: string, requestId: string, signal?: AbortSignal): Promise<ChatReceipt>;
  report(messageId: string, input: LetterReportRequest): Promise<LetterReportReceipt>;
}
export function readChatReceipt(value: unknown, requestId: string, peerId: string): ChatReceipt {
  if (!value || typeof value !== 'object') throw new ChatFault('connection'); const r = value as ChatReceipt;
  if (r.requestId !== requestId || r.peerId !== peerId || !validChatRequestId(requestId) || typeof r.completedAt !== 'string' || !Number.isFinite(Date.parse(r.completedAt)) || !(r.outcome === 'DELIVERED' && r.reason === null && typeof r.messageId === 'string' && /^chatmsg_[a-f0-9-]{36}$/.test(r.messageId) && Number.isSafeInteger(r.sequence) && r.sequence! > 0 || r.outcome === 'REJECTED' && ['CANCELLED', 'FRIEND_UNAVAILABLE', 'CONTENT_NOT_ALLOWED', 'DAILY_LIMIT'].includes(r.reason ?? '') && r.messageId === null && r.sequence === null)) throw new ChatFault('connection');
  return { requestId, peerId, outcome: r.outcome, reason: r.reason, messageId: r.messageId, sequence: r.sequence, completedAt: r.completedAt };
}
export function readChatPage(value: unknown, peerId: string): ChatPage {
  if (!value || typeof value !== 'object') throw new ChatFault('connection'); const p = value as ChatPage;
  if (!p.peer || p.peer.id !== peerId || !/^[a-z0-9_]{3,24}$/.test(p.peer.username) || !Array.isArray(p.messages) || p.messages.length > 50 || !Number.isSafeInteger(p.cursor) || p.cursor < 0 || p.before !== null && (!Number.isSafeInteger(p.before) || p.before < 1)) throw new ChatFault('connection');
  let last = 0;
  const messages = p.messages.map(message => {
    if (!message || !/^chatmsg_[a-f0-9-]{36}$/.test(message.id) || !Number.isSafeInteger(message.sequence) || message.sequence <= last || !['mine', 'theirs'].includes(message.side) || typeof message.text !== 'string' || !validMessage(message.text) || typeof message.createdAt !== 'string' || !Number.isFinite(Date.parse(message.createdAt))) throw new ChatFault('connection');
    last = message.sequence; return { id: message.id, sequence: message.sequence, side: message.side, text: message.text, createdAt: message.createdAt };
  });
  const character = p.peer.character;
  const peer: FriendPerson = { id: peerId, username: p.peer.username, character: character && CHARACTER_KEYS.includes(character.key) && character.palace && typeof character.palace.name === 'string' ? { id: character.id, key: character.key, displayName: character.displayName, assetUrl: character.assetUrl, title: character.title, description: character.description, palace: { theme: character.palace.theme, name: character.palace.name, description: character.palace.description }, ...(character.collection === 'royal' ? { collection: 'royal' as const } : {}) } : null };
  if (messages.length && p.cursor < messages[messages.length - 1]!.sequence) throw new ChatFault('connection');
  if (p.capabilities !== undefined && (!p.capabilities || typeof p.capabilities.textAvailable !== 'boolean')) throw new ChatFault('connection');
  return { peer, messages, cursor: p.cursor, before: p.before, ...(p.capabilities ? { capabilities: { textAvailable: p.capabilities.textAvailable } } : {}) };
}
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map(message => [message.id, message])); incoming.forEach(message => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence).slice(-200);
}

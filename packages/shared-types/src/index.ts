// Public API contracts only. Never re-export Prisma models or private user data.
export interface HealthResponse {
  status: 'ok';
  service: 'lantern-post-api';
}

export interface ReadinessResponse {
  status: 'ok' | 'error';
  service: 'lantern-post-api';
  checks: { database: 'up' | 'down' };
}

// Returned only to the authenticated account owner. Public letter responses
// must define their own contracts and must not embed this profile implicitly.
export interface SelfProfile {
  id: string;
  username: string;
  characterId: string | null;
  palaceTheme: string | null;
  createdAt: string;
}

export interface SelfResponse {
  user: SelfProfile | null;
}

export interface UsernameAvailabilityResponse {
  username: string;
  available: boolean;
}

export interface CreateProfileRequest {
  username: string;
  minimumAgeConfirmed: boolean;
}

export type CharacterKey = 'fox-lantern' | 'rabbit-moon' | 'owl-scholar' | 'deer-dawn' | 'cat-astral' | 'swan-cloud' | 'unicorn-aurelia' | 'peacock-seraph' | 'lion-solstice' | 'dragon-jade';
export type PalaceTheme = 'amber-hollow' | 'moonlit-conservatory' | 'starlight-library' | 'rosewood-sanctuary' | 'celestial-observatory' | 'cloud-court' | 'opal-citadel' | 'sapphire-pavilion' | 'suncrest-court' | 'jade-sanctuary';

export interface PalaceDetails {
  theme: PalaceTheme;
  name: string;
  description: string;
}

export interface CharacterDetails {
  id: string;
  key: CharacterKey;
  displayName: string;
  // A bundled:// identifier resolves to curated, offline artwork in the app.
  assetUrl: string;
  title: string;
  description: string;
  palace: PalaceDetails;
  collection?: 'royal'; // Editorial grouping for future entitlements; currently included for everyone.
}

export interface CharactersResponse {
  characters: CharacterDetails[];
}

export interface ChooseCharacterRequest {
  characterId: string;
}

export interface PalaceResponse {
  character: CharacterDetails | null;
}

export interface StationeryConfig {
  paperColor: string;
  inkColor: string;
  sealColor: string;
  ribbonColor: string;
  texture: 'parchment' | 'linen' | 'vellum';
  motif: 'stars' | 'floral' | 'royal' | 'postmark' | 'lace' | 'peacock' | 'rose-vine' | 'celestial' | 'regal' | 'gilded';
  font: 'book' | 'script' | 'classic';
}

export interface LetterPreset {
  id: string;
  key: string;
  displayName: string;
  description: string;
  config: StationeryConfig;
  collection?: 'royal';
}

export interface PresetsResponse {
  presets: LetterPreset[];
}

export interface BurnTextLetterRequest {
  requestId: string;
  type: 'TEXT';
  destinationType: 'BURNING';
  textContent: string;
  presetId: string;
  burnConfirmed: true;
}
export interface VoiceClip {
  id: string;
  mimeType: 'audio/webm' | 'audio/mp4';
  byteLength: number;
  durationMs: number;
}
export interface BurnVoiceLetterRequest {
  requestId: string;
  type: 'VOICE';
  destinationType: 'BURNING';
  presetId: string;
  burnConfirmed: true;
  audioMimeType: VoiceClip['mimeType'];
  audioByteLength: number;
  audioDurationMs: number;
}
export type BurnLetterRequest = BurnTextLetterRequest | BurnVoiceLetterRequest;

// A receipt contains no letter text or sender identity. Repeating the same
// owner/requestId returns the original outcome, including a durable rejection.
export interface BurnReceipt {
  requestId: string;
  receiptId: string;
  outcome: 'BURNED' | 'REJECTED';
  reason: 'PRESET_UNAVAILABLE' | null;
  completedAt: string;
}

export interface BurnReceiptResponse {
  receipt: BurnReceipt | null;
}

// Public social cards deliberately omit provider identity and private profile data.
export interface FriendPerson { id: string; username: string; character: CharacterDetails | null; }
export type FriendRelationship = 'NONE' | 'INCOMING' | 'OUTGOING' | 'FRIENDS' | 'UNAVAILABLE';
export interface FriendSearchResult { person: FriendPerson; relationship: FriendRelationship; requestId: string | null; }
export interface FriendSearchResponse { results: FriendSearchResult[]; hasMore: boolean; }
export interface FriendConnection {
  id: string;
  person: FriendPerson;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  respondedAt: string | null;
}
export type FriendsView = 'friends' | 'incoming' | 'outgoing';
export interface FriendsPage { items: FriendConnection[]; nextCursor: string | null; }
export interface FriendSummary { friends: number; incoming: number; outgoing: number; }
export interface SendFriendRequest { username: string; }
export interface RespondFriendRequest { action: 'accept' | 'decline'; }
export interface PushRegistration { token: string; platform: 'ios' | 'android'; }
export interface PushSettings { enabled: boolean; }

export interface FriendTextLetterRequest {
  requestId: string;
  type: 'TEXT';
  destinationType: 'FRIEND';
  textContent: string;
  presetId: string;
  recipientId: string;
  deliveryConfirmed: true;
}
export interface FriendVoiceLetterRequest {
  requestId: string;
  type: 'VOICE';
  destinationType: 'FRIEND';
  recipientId: string;
  presetId: string;
  deliveryConfirmed: true;
  voiceAssetId: string;
  voiceCaption?: string;
}
export type FriendLetterRequest = FriendTextLetterRequest | FriendVoiceLetterRequest;
export type DeliveryRejection = 'FRIEND_UNAVAILABLE' | 'PRESET_UNAVAILABLE' | 'CONTENT_NOT_ALLOWED' | 'DELIVERY_LIMIT' | 'VOICE_UNAVAILABLE' | 'CANCELLED';
export interface DeliveryReceipt {
  requestId: string;
  receiptId: string;
  recipientId: string;
  outcome: 'DELIVERED' | 'REJECTED';
  reason: DeliveryRejection | null;
  letterId: string | null;
  completedAt: string;
}
export interface DeliveryReceiptResponse { receipt: DeliveryReceipt | null; }
export interface LetterRecipient { id: string; username: string; characterKey: CharacterKey | null; palaceName: string; }

export interface ChatMessage { id: string; sequence: number; side: 'mine' | 'theirs'; text: string; createdAt: string; removed?: true; }
export interface ChatPage { peer: FriendPerson; messages: ChatMessage[]; cursor: number; before: number | null; capabilities?: ChatCapabilities; }
export interface ChatSendRequest { requestId: string; text: string; confirmed: true; }
export type ChatRejection = 'CANCELLED' | 'FRIEND_UNAVAILABLE' | 'CONTENT_NOT_ALLOWED' | 'DAILY_LIMIT';
export interface ChatReceipt { requestId: string; peerId: string; outcome: 'DELIVERED' | 'REJECTED'; reason: ChatRejection | null; messageId: string | null; sequence: number | null; completedAt: string; }
export interface ChatCapabilities { textAvailable: boolean; }
export type PalaceEventKind = 'FRIENDS_CHANGED'|'FRIEND_REQUEST'|'FRIEND_ACCEPTED'|'LETTERBOX_CHANGED'|'LETTER_REMOVED'|'LETTER_RECEIVED'|'CHAT_CHANGED'|'CHAT_RECEIVED'|'GATES_CHANGED';
export interface PalaceLiveEvent {id:string;sequence:number;kind:PalaceEventKind;peerId:string|null;itemId:string|null;createdAt:string;alert:boolean;}
export interface PalaceEventPage {events:PalaceLiveEvent[];cursor:number;reset:boolean;}
export type LetterBox = 'received' | 'sent';
export interface LetterEnvelope {
  id: string;
  person: FriendPerson;
  direction: LetterBox;
  preset: LetterPreset;
  deliveredAt: string;
  readAt: string | null;
  type: 'TEXT' | 'VOICE';
  audioDurationMs: number | null;
}
export interface LetterBoxPage { letters: LetterEnvelope[]; nextCursor: string | null; }
export interface LetterBoxSummary { unread: number; received: number; sent: number; }
export interface OpenedFriendLetter extends LetterEnvelope { textContent: string | null; audio: { url: string; expiresAt: string; mimeType: VoiceClip['mimeType']; durationMs: number; caption?: string | null } | null; }
export interface DeliveryCapabilities { textAvailable: boolean; voiceStorageAvailable?: boolean; voiceAvailable?: boolean; }

export type LetterReportReason = 'HARASSMENT' | 'SPAM' | 'HATE_SPEECH' | 'SELF_HARM_CONCERN' | 'OTHER';
export interface LetterReportRequest { reason: LetterReportReason; detail?: string; blockSender: boolean; confirmed: true; }
export interface LetterReportReceipt { id: string; status: 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED'; createdAt: string; blocked: boolean; }
export interface BlockedPalace { id: string; username: string | null; blockedAt: string; }
export interface BlockedPalacesPage { items: BlockedPalace[]; nextCursor: string | null; }
export interface VoiceUploadRequest { requestId: string; recipientId: string; mimeType: VoiceClip['mimeType']; byteLength: number; durationMs: number; sha256: string; }
export interface WorldVoiceUploadRequest extends Omit<VoiceUploadRequest, 'recipientId'> { destinationType: 'INFINITY'; }
export interface VoiceUploadGrant { assetId: string; uploadUrl: string | null; expiresAt: string; uploadViaApi?: boolean; }

export interface WorldBounds { minX: number; minY: number; maxX: number; maxY: number; }
export interface WorldStar { id: string; x: number; y: number; type: 'TEXT' | 'VOICE'; }
export interface WorldPage { stars: WorldStar[]; nextCursor: string | null; }
export interface WorldLetter extends WorldStar { preset: LetterPreset; textContent: string | null; audio: OpenedFriendLetter['audio']; signature: string | null; deliveredAt: string; mine: boolean; }
export interface WorldCapabilities { textAvailable: boolean; voiceAvailable: boolean; }
export interface WorldTextRequest { requestId: string; type: 'TEXT'; destinationType: 'INFINITY'; textContent: string; presetId: string; isSigned: boolean; publicConfirmed: true; }
export interface WorldVoiceRequest extends Omit<WorldTextRequest, 'type' | 'textContent'> { type: 'VOICE'; voiceAssetId: string; voiceCaption?: string; }
export type WorldLetterRequest = WorldTextRequest | WorldVoiceRequest;
export type WorldRejection = 'PRESET_UNAVAILABLE' | 'CONTENT_NOT_ALLOWED' | 'DELIVERY_LIMIT' | 'VOICE_UNAVAILABLE' | 'CANCELLED';
export interface WorldReceipt { requestId: string; receiptId: string; outcome: 'DELIVERED' | 'REJECTED'; isSigned: boolean; reason: WorldRejection | null; letterId: string | null; completedAt: string; }
export interface WorldReceiptResponse { receipt: WorldReceipt | null; }

export type DiagnosticsName = 'SESSION_OPEN' | 'DRAFT_SEALED' | 'BURN_COMPLETED' | 'FRIEND_DELIVERED' | 'WORLD_SHARED' | 'CLIENT_ERROR';
export interface DiagnosticsInput { eventId: string; name: DiagnosticsName; platform: 'web' | 'ios' | 'android'; code?: 'RENDER_ERROR' | 'UNHANDLED_ERROR'; requestId?: string; }
export interface DiagnosticsPreferences { enabled: boolean; }

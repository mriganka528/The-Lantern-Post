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

export type CharacterKey = 'fox-lantern' | 'rabbit-moon' | 'owl-scholar' | 'deer-dawn' | 'cat-astral' | 'swan-cloud';
export type PalaceTheme = 'amber-hollow' | 'moonlit-conservatory' | 'starlight-library' | 'rosewood-sanctuary' | 'celestial-observatory' | 'cloud-court';

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
  motif: 'stars' | 'floral' | 'royal' | 'postmark';
  font: 'book' | 'script' | 'classic';
}

export interface LetterPreset {
  id: string;
  key: string;
  displayName: string;
  description: string;
  config: StationeryConfig;
}

export interface PresetsResponse {
  presets: LetterPreset[];
}

export interface BurnLetterRequest {
  requestId: string;
  type: 'TEXT';
  destinationType: 'BURNING';
  textContent: string;
  presetId: string;
  burnConfirmed: true;
}

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

export interface FriendLetterRequest {
  requestId: string;
  type: 'TEXT';
  destinationType: 'FRIEND';
  textContent: string;
  presetId: string;
  recipientId: string;
  deliveryConfirmed: true;
}
export type DeliveryRejection = 'FRIEND_UNAVAILABLE' | 'PRESET_UNAVAILABLE' | 'CONTENT_NOT_ALLOWED' | 'DELIVERY_LIMIT' | 'CANCELLED';
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
export type LetterBox = 'received' | 'sent';
export interface LetterEnvelope {
  id: string;
  person: FriendPerson;
  direction: LetterBox;
  preset: LetterPreset;
  deliveredAt: string;
  readAt: string | null;
}
export interface LetterBoxPage { letters: LetterEnvelope[]; nextCursor: string | null; }
export interface LetterBoxSummary { unread: number; received: number; sent: number; }
export interface OpenedFriendLetter extends LetterEnvelope { textContent: string; }
export interface DeliveryCapabilities { moderationAvailable: boolean; }

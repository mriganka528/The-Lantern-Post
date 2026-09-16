import { Text, View } from 'react-native';
import { s } from '../storybook/story-ui';
import { RemoveAudioButton } from './voice-playback-controls';
import type { VoicePlayerProps } from './voice-playback-controls';
export function VoicePlayer({ onRemove, removeDisabled }: VoicePlayerProps) { return <View style={{ gap: 12 }}><Text style={s.body}>Voice playback is unavailable in this build.</Text>{onRemove && <RemoveAudioButton onPress={onRemove} disabled={removeDisabled} />}</View>; }

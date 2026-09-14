import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StoryButton, StoryDialog, TextAction, s } from '../storybook/story-ui';
import { Flourish } from '../storybook/ornaments';
import { serif } from '../storybook/theme';
import { policies, policyEdition, policyReviewNotice } from './policies';
import type { PolicyKind } from './policies';
export function PolicyLinks() {
  const [kind, setKind] = useState<PolicyKind | null>(null);
  return <><View style={styles.links}><TextAction label="Terms of Service" onPress={() => setKind('terms')} /><TextAction label="Privacy Policy" onPress={() => setKind('privacy')} /></View>{kind && <StoryDialog title={policies[kind].title} onClose={() => setKind(null)}><Flourish width={170} /><Text style={styles.edition}>{policyEdition}</Text><Text style={s.body}>{policyReviewNotice}</Text>{policies[kind].sections.map(section => <View key={section.title} style={{ gap: 8 }}><Text role="heading" style={styles.heading}>{section.title}</Text><Text style={s.body}>{section.text}</Text></View>)}<StoryButton label="Return to the palace pages" onPress={() => setKind(null)} secondary /></StoryDialog>}</>;
}
const styles = StyleSheet.create({ links: { flexDirection: 'row', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }, edition: { fontSize: 11, color: '#8A714A', textAlign: 'center' }, heading: { fontFamily: serif, fontSize: 21, color: '#624E32' } });

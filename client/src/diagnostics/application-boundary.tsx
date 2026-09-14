import { Component } from 'react';
import type { PropsWithChildren } from 'react';
import { ActionButton, AuthPage } from '../components/auth-ui';
import { useDiagnostics } from './diagnostics-context';
import { pauseVoicePlayback } from '../voice/playback-registry';
class ScreenBoundary extends Component<PropsWithChildren<{ report(): void }>, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { pauseVoicePlayback(); this.props.report(); }
  render() { return this.state.failed ? <AuthPage title="Your palace needs a moment" subtitle="This screen could not open. Your saved letters remain on this device; try opening it again."><ActionButton label="Try opening the screen again" onPress={() => this.setState({ failed: false })} /></AuthPage> : this.props.children; }
}
export function ApplicationBoundary({ children }: PropsWithChildren) {
  const diagnostics = useDiagnostics(); return <ScreenBoundary report={() => diagnostics.track({ name: 'CLIENT_ERROR', code: 'RENDER_ERROR' }, 'render-error')}>{children}</ScreenBoundary>;
}

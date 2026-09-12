// Clerk keeps the create/prepare/attempt API in this supported compatibility entry.
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { clerkErrorMessage } from '../src/auth/clerk-errors';
import { useOnboardingDraft } from '../src/auth/onboarding-store';
import { useGoogleSignIn } from '../src/auth/use-google-sign-in';
import { ActionButton, AgeConfirmation, AuthPage, FormError, LoadingScreen, styles } from '../src/components/auth-ui';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const { isLoaded: signInLoaded, signIn, setActive: activateSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: activateSignUp } = useSignUp();
  const googleSignIn = useGoogleSignIn();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [signInEmailId, setSignInEmailId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const busyRef = useRef(false);
  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    const update = () => setResendIn(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  async function perform(operation: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try { await operation(); } catch (cause) { setError(clerkErrorMessage(cause)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function sendCode() {
    if (!signInLoaded || !signUpLoaded) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'sign-up' && !ageConfirmed) {
      setError('Confirm that you are at least 13 years old to create an account.');
      return;
    }
    void perform(async () => {
      if (mode === 'sign-up') {
        await signUp.create({ emailAddress: normalizedEmail });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        useOnboardingDraft.getState().confirmMinimumAge(normalizedEmail);
      } else {
        const attempt = await signIn.create({ identifier: normalizedEmail });
        const factor = attempt.supportedFirstFactors?.find((item) => item.strategy === 'email_code');
        if (!factor || factor.strategy !== 'email_code') throw new Error('Email code factor unavailable');
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
        setSignInEmailId(factor.emailAddressId);
      }
      setEmail(normalizedEmail);
      setCode('');
      setResendAt(Date.now() + 60_000);
      setStage('code');
    });
  }

  function continueWithGoogle() {
    if (!ageConfirmed) {
      setError('Confirm that you are at least 13 years old before continuing with Google.');
      return;
    }
    void perform(async () => {
      setGoogleBusy(true);
      try { await googleSignIn(ageConfirmed); } finally { setGoogleBusy(false); }
    });
  }

  function verifyCode() {
    if (!signInLoaded || !signUpLoaded) return;
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the six-digit code from your email.'); return; }
    void perform(async () => {
      if (mode === 'sign-up') {
        const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (attempt.status !== 'complete' || !attempt.createdSessionId) throw new Error('Signup is incomplete');
        await activateSignUp({ session: attempt.createdSessionId });
      } else {
        const attempt = await signIn.attemptFirstFactor({ strategy: 'email_code', code: code.trim() });
        if (attempt.status !== 'complete' || !attempt.createdSessionId) throw new Error('Sign-in is incomplete');
        await activateSignIn({ session: attempt.createdSessionId });
      }
      // The root navigation reacts to Clerk's authenticated session. No client
      // flag or unverified code grants access to the protected screens.
    });
  }

  function resendCode() {
    if (!signInLoaded || !signUpLoaded || Date.now() < resendAt) return;
    void perform(async () => {
      if (mode === 'sign-up') {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      } else {
        if (!signInEmailId) throw new Error('Missing email factor');
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: signInEmailId });
      }
      setCode('');
      setResendAt(Date.now() + 60_000);
    });
  }

  if (!signInLoaded || !signUpLoaded) return <LoadingScreen />;

  if (stage === 'code') {
    return <AuthPage title="A little letter for you" subtitle={`Enter the six-digit code sent to ${email}.`}>
      <View>
        <Text style={styles.label}>Verification code</Text>
        <TextInput accessibilityLabel="Verification code" style={styles.input} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
          keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} editable={!busy} onSubmitEditing={verifyCode} />
      </View>
      <FormError message={error} />
      <ActionButton label={busy ? 'Opening your gate…' : 'Continue'} onPress={verifyCode} disabled={busy || code.length !== 6} />
      <ActionButton label={resendIn > 0 ? `Send another code in ${resendIn}s` : 'Send another code'} onPress={resendCode} disabled={busy || resendIn > 0} secondary />
      <ActionButton label="Use a different email" onPress={() => { setStage('email'); setCode(''); setError(null); }} disabled={busy} secondary />
    </AuthPage>;
  }

  return <AuthPage title={mode === 'sign-up' ? 'A gate of your own' : 'Welcome back'} subtitle="A quiet place to write what is on your heart.">
    <AgeConfirmation checked={ageConfirmed} onChange={setAgeConfirmed} disabled={busy} />
    <ActionButton label={googleBusy ? 'Connecting to Google…' : 'Continue with Google'} onPress={continueWithGoogle} disabled={busy || !ageConfirmed} secondary />
    <Text style={styles.hint}>Or continue with an email code.</Text>
    <View>
      <Text style={styles.label}>Email address</Text>
      <TextInput accessibilityLabel="Email address" style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address"
        autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!busy} maxLength={254} onSubmitEditing={sendCode} />
    </View>
    <FormError message={error} />
    <ActionButton label={busy && !googleBusy ? 'Sending your code…' : 'Send a verification code'} onPress={sendCode} disabled={busy || !normalizedEmail || (mode === 'sign-up' && !ageConfirmed)} />
    <ActionButton label={mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'} onPress={() => {
      setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(null); setAgeConfirmed(false); useOnboardingDraft.getState().clear();
    }} disabled={busy} secondary />
  </AuthPage>;
}

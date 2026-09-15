// Clerk keeps the create/prepare/attempt API in this supported compatibility entry.
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { clerkErrorMessage } from '../src/auth/clerk-errors';
import { useOnboardingDraft } from '../src/auth/onboarding-store';
import { useGoogleSignIn } from '../src/auth/use-google-sign-in';
import { ActionButton, AgeConfirmation, AuthPage, FormError, LoadingScreen, styles } from '../src/components/auth-ui';
import { signupNextStep } from '../src/auth/email-flow';
import type { SignupField, SignupResult } from '../src/auth/email-flow';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const { isLoaded: signInLoaded, signIn, setActive: activateSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: activateSignUp } = useSignUp();
  const googleSignIn = useGoogleSignIn();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [stage, setStage] = useState<'email' | 'code' | 'details'>('email');
  const [required, setRequired] = useState<SignupField[]>([]);
  const [details, setDetails] = useState({ first_name: '', last_name: '', username: '', password: '', legal_accepted: false });
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
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
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
    try { await operation(); } catch (cause) { if (mounted.current) setError(clerkErrorMessage(cause)); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }

  async function finishSignup(attempt: SignupResult) {
    if (!mounted.current) return;
    const next = signupNextStep(attempt);
    if (next.kind === 'complete') {
      setDetails({ first_name: '', last_name: '', username: '', password: '', legal_accepted: false });
      await activateSignUp!({ session: next.sessionId });
    } else { setCode(''); setRequired(next.fields); setStage('details'); }
  }

  function completeDetails() {
    if (!signUpLoaded) return;
    if (required.some(field => field === 'legal_accepted' ? !details.legal_accepted : !details[field].trim())) { setError('Complete each required detail to continue.'); return; }
    void perform(async () => {
      const attempt = await signUp.update({
        ...(required.includes('first_name') ? { firstName: details.first_name.trim() } : {}),
        ...(required.includes('last_name') ? { lastName: details.last_name.trim() } : {}),
        ...(required.includes('username') ? { username: details.username.trim() } : {}),
        ...(required.includes('password') ? { password: details.password } : {}),
        ...(required.includes('legal_accepted') ? { legalAccepted: details.legal_accepted } : {}),
      });
      await finishSignup(attempt);
    });
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
        const attempt = signUp.verifications.emailAddress.status === 'verified' ? signUp : await signUp.attemptEmailAddressVerification({ code: code.trim() });
        await finishSignup(attempt);
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

  if (stage === 'details') return <AuthPage title="One last step for your account" subtitle="Your email is verified. Complete the remaining details to open your gate.">
    {required.filter((field): field is Exclude<SignupField, 'legal_accepted'> => field !== 'legal_accepted').map(field => <View key={field}>
      <Text style={styles.label}>{{ first_name: 'First name', last_name: 'Last name', username: 'Username', password: 'Password' }[field]}</Text>
      <TextInput accessibilityLabel={{ first_name: 'First name', last_name: 'Last name', username: 'Username', password: 'Password' }[field]} style={styles.input} value={details[field]} onChangeText={value => setDetails(old => ({ ...old, [field]: value }))} secureTextEntry={field === 'password'} autoCapitalize={field === 'first_name' || field === 'last_name' ? 'words' : 'none'} autoCorrect={false} editable={!busy} maxLength={field === 'password' ? 256 : 100} autoComplete={field === 'password' ? 'new-password' : field === 'username' ? 'username-new' : field === 'first_name' ? 'given-name' : 'family-name'} />
    </View>)}
    {required.includes('legal_accepted') && <Pressable accessibilityRole="checkbox" accessibilityLabel="I agree to the Terms of Service and Privacy Policy" accessibilityState={{ checked: details.legal_accepted, disabled: busy }} disabled={busy} onPress={() => setDetails(old => ({ ...old, legal_accepted: !old.legal_accepted }))} style={styles.checkboxRow}><Text style={styles.checkboxLabel}>{details.legal_accepted ? '☑' : '☐'} I agree to the Terms of Service and Privacy Policy linked below.</Text></Pressable>}
    <FormError message={error} /><ActionButton label={busy ? 'Opening your gate…' : 'Complete my account'} onPress={completeDetails} disabled={busy} />
    <ActionButton label="Return to sign-in" secondary disabled={busy} onPress={() => { setStage('email'); setMode('sign-in'); setDetails({ first_name: '', last_name: '', username: '', password: '', legal_accepted: false }); setError(null); }} />
  </AuthPage>;

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

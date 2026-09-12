// Mounted beside the router so navigation and loading never remove or duplicate
// the widget. Google can also create an account and require a visible challenge.
export function ClerkCaptcha() {
  return <div id="clerk-captcha" style={{ alignSelf: 'center', flexShrink: 0 }} />;
}

// The repository root is a workspace; client/ owns the Expo app and its config.
// Fail before Expo chooses its default AppEntry or creates app files here.
module.exports = () => {
  throw new Error([
    'Lantern Post lives in client/. Start it from the repository root with:',
    '  npm.cmd run dev:web -- --clear   (browser preview)',
    '  npm.cmd start -- --clear         (Expo Go)',
    'Or point Expo directly at the app:',
    '  npx.cmd expo start ./client --clear',
  ].join('\n'));
};

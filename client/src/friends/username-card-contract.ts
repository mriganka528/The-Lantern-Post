export function usernameCard(username: string) {
  if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('Invalid username.');
  return { title: 'My Lantern Post calling card', text: `Find my palace on The Lantern Post: @${username}\nOpen the friendship court and search for @${username}.` };
}

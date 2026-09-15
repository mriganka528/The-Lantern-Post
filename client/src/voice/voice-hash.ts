// Hermes does not guarantee browser globals such as btoa. Encode the binary
// SHA-256 digest directly; hashing a string representation changes the hash.
export function voiceDigestBase64(digest: ArrayBuffer): string {
  const bytes = new Uint8Array(digest);
  if (bytes.length !== 32) throw Error('Invalid recording digest');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
    encoded += alphabet[a >> 2]! + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    encoded += b === undefined ? '=' : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    encoded += c === undefined ? '=' : alphabet[c & 63]!;
  }
  return encoded;
}

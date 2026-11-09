/**
 * PKCE (RFC 7636) primitives built on the Web Crypto API.
 */

/** @param {Uint8Array} bytes */
export function base64UrlEncode(bytes) {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Cryptographically random, URL-safe string.
 * 48 bytes → 64 characters, inside the 43–128 range RFC 7636 requires for a verifier.
 *
 * @param {number} [byteLength=48]
 * @param {Crypto} [cryptoImpl=globalThis.crypto]
 */
export function generateRandomString(byteLength = 48, cryptoImpl = globalThis.crypto) {
    const bytes = new Uint8Array(byteLength);
    cryptoImpl.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

/**
 * S256 code challenge: BASE64URL(SHA256(verifier)).
 * Requires a secure context (https or localhost) because `crypto.subtle` is
 * unavailable on plain http.
 *
 * @param {string} verifier
 * @param {Crypto} [cryptoImpl=globalThis.crypto]
 */
export async function createCodeChallenge(verifier, cryptoImpl = globalThis.crypto) {
    if (!cryptoImpl?.subtle) {
        throw new Error('crypto.subtle is unavailable: PKCE requires a secure context (https:// or http://localhost)');
    }
    const digest = await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64UrlEncode(new Uint8Array(digest));
}

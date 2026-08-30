const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;
const PREFIX = "enc:v1:";

function normalizeKey(value) {
  const text = String(value || "").trim();

  if (!text) {
    throw new Error(
      "PAYMENT_ENCRYPTION_KEY belum dikonfigurasi."
    );
  }

  // Dukungan hex 64 karakter = 32 bytes
  if (/^[a-f0-9]{64}$/i.test(text)) {
    const bytes = new Uint8Array(32);

    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(
        text.slice(i * 2, i * 2 + 2),
        16
      );
    }

    return bytes;
  }

  // Default: base64 / base64url
  let base64 = text
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (base64.length % 4) {
    base64 += "=";
  }

  try {
    const binary = atob(base64);

    if (binary.length !== 32) {
      throw new Error(
        "PAYMENT_ENCRYPTION_KEY harus berukuran 32 bytes."
      );
    }

    return Uint8Array.from(
      binary,
      char => char.charCodeAt(0)
    );
  } catch {
    throw new Error(
      "PAYMENT_ENCRYPTION_KEY harus berupa base64/base64url 32 bytes atau hex 64 karakter."
    );
  }
}

async function importKey(env) {
  const rawKey = normalizeKey(
    env.PAYMENT_ENCRYPTION_KEY
  );

  return crypto.subtle.importKey(
    "raw",
    rawKey,
    {
      name: ALGORITHM,
    },
    false,
    [
      "encrypt",
      "decrypt",
    ]
  );
}

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);

  return Uint8Array.from(
    binary,
    char => char.charCodeAt(0)
  );
}

export function isEncrypted(value) {
  return (
    typeof value === "string" &&
    value.startsWith(PREFIX)
  );
}

export async function encryptSecret(
  env,
  plaintext
) {
  if (
    plaintext === null ||
    plaintext === undefined ||
    plaintext === ""
  ) {
    return plaintext;
  }

  const text = String(plaintext);

  if (isEncrypted(text)) {
    return text;
  }

  const key = await importKey(env);

  const iv = crypto.getRandomValues(
    new Uint8Array(IV_LENGTH)
  );

  const encoded = new TextEncoder().encode(
    text
  );

  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    encoded
  );

  return (
    PREFIX +
    bytesToBase64(iv) +
    ":" +
    bytesToBase64(
      new Uint8Array(encrypted)
    )
  );
}

export async function decryptSecret(
  env,
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return value;
  }

  const text = String(value);

  // Plaintext lama: jangan gagal.
  // Caller akan menangani migrasi.
  if (!isEncrypted(text)) {
    return text;
  }

  const payload = text.slice(
    PREFIX.length
  );

  const parts = payload.split(":");

  if (parts.length !== 2) {
    throw new Error(
      "Format encrypted secret tidak valid."
    );
  }

  const iv = base64ToBytes(parts[0]);
  const ciphertext = base64ToBytes(parts[1]);

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      "IV encrypted secret tidak valid."
    );
  }

  const key = await importKey(env);

  try {
    const decrypted =
      await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv,
          tagLength: TAG_LENGTH,
        },
        key,
        ciphertext
      );

    return new TextDecoder().decode(
      decrypted
    );
  } catch {
    throw new Error(
      "Tidak dapat mendekripsi payment secret. Pastikan PAYMENT_ENCRYPTION_KEY benar."
    );
  }
}

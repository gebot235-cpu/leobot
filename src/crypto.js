const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const TAG_LENGTH = 128;
const PREFIX = "enc:v1:";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getKeyBytes(value) {
  const key = String(value || "").trim();

  if (!key) {
    throw new Error(
      "PAYMENT_ENCRYPTION_KEY belum dikonfigurasi."
    );
  }

  // Dukungan HEX 64 karakter = 32 bytes
  if (/^[a-f0-9]{64}$/i.test(key)) {
    const bytes = new Uint8Array(32);

    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(
        key.slice(i * 2, i * 2 + 2),
        16
      );
    }

    return bytes;
  }

  // Dukungan Base64 / Base64URL
  let base64 = key
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  try {
    const binary = atob(base64);

    if (binary.length !== 32) {
      throw new Error();
    }

    const bytes = new Uint8Array(
      binary.length
    );

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  } catch {
    throw new Error(
      "PAYMENT_ENCRYPTION_KEY harus berupa Base64 32 bytes atau HEX 64 karakter."
    );
  }
}

async function getCryptoKey(env) {
  return crypto.subtle.importKey(
    "raw",
    getKeyBytes(
      env.PAYMENT_ENCRYPTION_KEY
    ),
    {
      name: ALGORITHM,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);

  const bytes = new Uint8Array(
    binary.length
  );

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function isEncryptedSecret(value) {
  return (
    typeof value === "string" &&
    value.startsWith(PREFIX)
  );
}

export async function encryptSecret(
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

  const plaintext = String(value);

  // Jangan encrypt dua kali
  if (isEncryptedSecret(plaintext)) {
    return plaintext;
  }

  const key = await getCryptoKey(env);

  const iv = crypto.getRandomValues(
    new Uint8Array(IV_LENGTH)
  );

  const encrypted =
    await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH,
      },
      key,
      textEncoder.encode(plaintext)
    );

  return [
    PREFIX.slice(0, -1),
    toBase64(iv),
    toBase64(
      new Uint8Array(encrypted)
    ),
  ].join(":");
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

  const encrypted = String(value);

  // Untuk data lama yang masih plaintext.
  if (
    !isEncryptedSecret(encrypted)
  ) {
    return encrypted;
  }

  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error(
      "Format encrypted payment secret tidak valid."
    );
  }

  const iv = fromBase64(parts[1]);
  const ciphertext = fromBase64(parts[2]);

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      "IV encrypted payment secret tidak valid."
    );
  }

  const key = await getCryptoKey(env);

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

    return textDecoder.decode(
      decrypted
    );
  } catch {
    throw new Error(
      "Gagal mendekripsi payment secret. Periksa PAYMENT_ENCRYPTION_KEY."
    );
  }
}

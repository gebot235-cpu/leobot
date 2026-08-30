import {
  encryptSecret,
} from "./crypto.js";

const ENCRYPTED_SETTING_KEYS =
  new Set([
    "payment_secret_token",
    "payment_webhook_secret",
  ]);

export async function supabase(
  env,
  path,
  method = "GET",
  body = null,
  headers = {}
) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/${path}`,
    {
      method,
      headers: {
        apikey:
          env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization:
          `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type":
          "application/json",
        ...headers,
      },
      body: body
        ? JSON.stringify(body)
        : undefined,
    }
  );

  if (!response.ok) {
    const error =
      await response.text();

    throw new Error(
      `Supabase error: ${error}`
    );
  }

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    return response.json();
  }

  return null;
}

/**
 * Setting yang dianggap secret.
 *
 * Hanya credential payment yang dienkripsi.
 * Setting biasa seperti:
 * - payment_enabled
 * - payment_account_id
 * - payment_fee_type
 * - payment_fee_value
 * - payment_qris_method
 * - payment_test
 *
 * tetap plaintext.
 */
async function prepareSettingValue(
  env,
  key,
  value
) {
  if (
    !ENCRYPTED_SETTING_KEYS.has(key)
  ) {
    return String(value);
  }

  return encryptSecret(
    env,
    String(value)
  );
}

/**
 * Upsert baris key-value pada tabel settings.
 *
 * Secret payment otomatis dienkripsi
 * sebelum disimpan ke Supabase.
 */
export async function upsertSetting(
  env,
  key,
  value
) {
  const storedValue =
    await prepareSettingValue(
      env,
      key,
      value
    );

  const now =
    new Date().toISOString();

  const patched =
    await supabase(
      env,
      `settings?key=eq.${encodeURIComponent(key)}`,
      "PATCH",
      {
        value: storedValue,
        updated_at: now,
      },
      {
        Prefer:
          "return=representation",
      }
    );

  if (
    patched &&
    patched.length > 0
  ) {
    return patched;
  }

  return supabase(
    env,
    "settings",
    "POST",
    {
      key,
      value: storedValue,
      updated_at: now,
    },
    {
      Prefer:
        "return=representation",
    }
  );
}

import {
  sendPhoto,
  editMessage,
} from "./telegram.js";

import {
  supabase,
  upsertSetting,
} from "./supabase.js";

import {
  saveState,
  deleteState,
} from "./state.js";

import {
  deliverProduct,
} from "./fulfillment.js";

import {
  decryptSecret,
  isEncryptedSecret,
} from "./crypto.js";

const BUATQRIS_API =
  "https://api.buatqris.site";

export async function showPaymentMenu(
  env,
  chatId,
  messageId
) {
  const settings =
    await getPaymentSettings(env);

  return editMessage(
    env,
    chatId,
    messageId,
`💳 PEMBAYARAN

Status: ${
      settings.enabled
        ? "🟢 AKTIF"
        : "🔴 NONAKTIF"
    }

QRIS: ${
      settings.qris_method
    }

Mode: ${
      settings.test
        ? "TEST"
        : "LIVE"
    }

Fee: ${
      settings.fee_type === "percent"
        ? `${settings.fee_value}%`
        : `Rp${Number(
            settings.fee_value || 0
          ).toLocaleString("id-ID")}`
    }`,
    [
      [
        {
          text:
            settings.enabled
              ? "🔴 NONAKTIFKAN"
              : "🟢 AKTIFKAN",
          callback_data:
            "admin:payment:toggle",
        },
      ],
      [
        {
          text: "⚙️ ATUR PEMBAYARAN",
          callback_data:
            "admin:payment:config",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:menu",
        },
      ],
    ]
  );
}

export async function showPaymentConfig(
  env,
  chatId,
  messageId
) {
  const settings =
    await getPaymentSettings(env);

  return editMessage(
    env,
    chatId,
    messageId,
`⚙️ ATUR PEMBAYARAN

Account ID:
${maskValue(settings.account_id)}

Secret Token:
${
      settings.secret_token
        ? "••••••••"
        : "Belum diatur"
    }

Webhook Secret:
${
      settings.webhook_secret
        ? "••••••••"
        : "Belum diatur"
    }

QRIS Method:
${settings.qris_method}

Mode:
${settings.test ? "TEST" : "LIVE"}

Fee:
${
      settings.fee_type === "percent"
        ? `${settings.fee_value}%`
        : `Rp${Number(
            settings.fee_value || 0
          ).toLocaleString("id-ID")}`
    }`,
    [
      [
        {
          text: "🔑 ACCOUNT ID",
          callback_data:
            "admin:payment:setting:account_id",
        },
      ],
      [
        {
          text: "🔐 SECRET TOKEN",
          callback_data:
            "admin:payment:setting:secret_token",
        },
      ],
      [
        {
          text: "🛡️ WEBHOOK SECRET",
          callback_data:
            "admin:payment:setting:webhook_secret",
        },
      ],
      [
        {
          text: "📊 FEE",
          callback_data:
            "admin:payment:setting:fee",
        },
      ],
      [
        {
          text: "🔄 QRIS METHOD",
          callback_data:
            "admin:payment:setting:qris_method",
        },
      ],
      [
        {
          text: settings.test
            ? "🟢 LIVE MODE"
            : "🧪 TEST MODE",
          callback_data:
            "admin:payment:setting:test",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:payment",
        },
      ],
    ]
  );
}

export async function startPaymentSetting(
  env,
  chatId,
  messageId,
  field
) {
  const settings =
    await getPaymentSettings(env);

  if (
    field === "test"
  ) {
    await setSetting(
      env,
      "payment_test",
      settings.test ? "0" : "1"
    );

    return showPaymentConfig(
      env,
      chatId,
      messageId
    );
  }

  if (
    field === "qris_method"
  ) {
    const method =
      settings.qris_method ===
      "qris_two"
        ? "qris_one"
        : "qris_two";

    await setSetting(
      env,
      "payment_qris_method",
      method
    );

    return showPaymentConfig(
      env,
      chatId,
      messageId
    );
  }

  if (
    field === "fee"
  ) {
    await saveState(
      env,
      chatId,
      {
        type:
          "PAYMENT_SETTING",
        field:
          "fee",
        message_id:
          messageId,
      }
    );

    return editMessage(
      env,
      chatId,
      messageId,
`📊 ATUR FEE

Format:
persen 10
atau
nominal 500

Kirim nilai fee:`,
      [
        [
          {
            text: "❌ BATAL",
            callback_data:
              "admin:payment:cancel",
          },
        ],
      ]
    );
  }

  const labels = {
    account_id:
      "ACCOUNT ID",
    secret_token:
      "SECRET TOKEN",
    webhook_secret:
      "WEBHOOK SECRET",
  };

  if (!labels[field]) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type:
        "PAYMENT_SETTING",
      field,
      message_id:
        messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`🔐 ${labels[field]}

Kirim nilai baru:`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:payment:cancel",
        },
      ],
    ]
  );
}

export async function handlePaymentSettingInput(
  env,
  message,
  state
) {
  const value =
    message.text?.trim();

  if (!value) {
    return true;
  }

  if (
    state.field ===
    "account_id"
  ) {
    await setSetting(
      env,
      "payment_account_id",
      value
    );
  } else if (
    state.field ===
    "secret_token"
  ) {
    await setSetting(
      env,
      "payment_secret_token",
      value
    );
  } else if (
    state.field ===
    "webhook_secret"
  ) {
    await setSetting(
      env,
      "payment_webhook_secret",
      value
    );
  } else if (
    state.field ===
    "fee"
  ) {
    const match =
      value.match(
        /^(persen|nominal)\s+(\d+(?:\.\d+)?)$/i
      );

    if (!match) {
      await editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Format tidak valid.

Gunakan:
persen 10

atau:

nominal 500`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data:
                "admin:payment:cancel",
            },
          ],
        ]
      );

      return true;
    }

    const type =
      match[1].toLowerCase();

    const number =
      Number(match[2]);

    if (
      !Number.isFinite(
        number
      ) ||
      number < 0
    ) {
      return true;
    }

    await setSetting(
      env,
      "payment_fee_type",
      type === "persen"
        ? "percent"
        : "fixed"
    );

    await setSetting(
      env,
      "payment_fee_value",
      String(number)
    );
  }

  await deleteState(
    env,
    message.chat.id
  );

  return showPaymentConfig(
    env,
    message.chat.id,
    state.message_id
  );
}

export async function savePaymentSetting(
  env,
  chatId,
  messageId
) {
  await deleteState(
    env,
    chatId
  );

  return showPaymentConfig(
    env,
    chatId,
    messageId
  );
}

export async function cancelPaymentSetting(
  env,
  chatId,
  messageId
) {
  await deleteState(
    env,
    chatId
  );

  return showPaymentConfig(
    env,
    chatId,
    messageId
  );
}

export async function togglePayment(
  env,
  chatId,
  messageId
) {
  const settings =
    await getPaymentSettings(env);

  await setSetting(
    env,
    "payment_enabled",
    settings.enabled
      ? "false"
      : "true"
  );

  return showPaymentMenu(
    env,
    chatId,
    messageId
  );
}

export async function createPayment(
  env,
  telegramId,
  product,
  firstName = null
) {
  const settings =
    await getPaymentSettings(env);

  if (
    !settings.enabled
  ) {
    throw new Error(
      "Pembayaran sedang nonaktif."
    );
  }

  if (
    !settings.account_id ||
    !settings.secret_token
  ) {
    throw new Error(
      "Payment gateway belum dikonfigurasi."
    );
  }

  const baseAmount =
    Number(product.price || 0);

  if (
    !Number.isSafeInteger(
      baseAmount
    ) ||
    baseAmount <= 0
  ) {
    throw new Error(
      "Harga produk tidak valid."
    );
  }

  let amount =
    baseAmount;

  if (
    settings.fee_type ===
    "percent"
  ) {
    amount =
      Math.round(
        baseAmount +
          baseAmount *
            Number(
              settings.fee_value ||
                0
            ) /
            100
      );
  } else {
    amount =
      Math.round(
        baseAmount +
          Number(
            settings.fee_value ||
              0
          )
      );
  }

  const orderCode =
    `INV-${Date.now()}-${telegramId}`;

  const rows =
    await supabase(
      env,
      "orders",
      "POST",
      {
        order_code:
          orderCode,
        telegram_id:
          Number(
            telegramId
          ),
        product_id:
          Number(
            product.id
          ),
        amount,
        first_name:
          firstName || null,
        status:
          "PENDING",
      },
      {
        Prefer:
          "return=representation",
      }
    );

  const order =
    rows?.[0];

  if (!order) {
    throw new Error(
      "Gagal membuat order."
    );
  }

  let response;

  try {
    response =
      await fetch(
        BUATQRIS_API,
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              action:
                "api_create_qris",
              account_id:
                settings.account_id,
              secret_token:
                settings.secret_token,
              amount,
              description:
                `Pembayaran order #${orderCode}`,
              qris_method:
                settings.qris_method,
              test:
                settings.test
                  ? 1
                  : 0,
            }),
          }
        );
  } catch {
    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      "Tidak dapat menghubungi BuatQris."
    );
  }

  let data;

  try {
    data =
      await response.json();
  } catch {
    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      "Respons BuatQris tidak valid."
    );
  }

  if (
    !response.ok ||
    data?.success === false
  ) {
    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      data?.message ||
        "Gagal membuat QRIS."
    );
  }

  const paymentId =
    data.transaction_id ||
    data.payment_id ||
    data.data?.transaction_id ||
    data.data?.payment_id;

  const qrUrl =
    data.qr_url ||
    data.qr_code ||
    data.data?.qr_url ||
    data.data?.qr_code;

  const expiresAt =
    data.expires_at ||
    data.data?.expires_at ||
    new Date(
      Date.now() +
        15 * 60 * 1000
    ).toISOString();

  if (!paymentId) {
    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      "BuatQris tidak mengembalikan transaction_id."
    );
  }

  if (!qrUrl) {
    await updateOrder(
      env,
      order.id,
      {
        status:
          "FAILED",
      }
    );

    throw new Error(
      "BuatQris tidak mengembalikan QRIS."
    );
  }

  await updateOrder(
    env,
    order.id,
    {
      payment_id:
        paymentId,
      qr_url:
        qrUrl,
      qr_expires_at:
        expiresAt,
    }
  );

  return {
    ...order,
    amount,
    payment_id:
      paymentId,
    qr_url:
      qrUrl,
    qr_expires_at:
      expiresAt,
  };
}

export async function sendPaymentQr(
  env,
  chatId,
  order
) {
  if (
    !order?.qr_url
  ) {
    throw new Error(
      "QRIS tidak tersedia."
    );
  }

  return sendPhoto(
    env,
    chatId,
    order.qr_url
  );
}

export async function handleBuatQrisWebhook(
  env,
  request
) {
  const body =
    await request.text();

  const signature =
    request.headers.get(
      "X-BuatQris-Signature"
    );

  const settings =
    await getPaymentSettings(env);

  if (
    !settings.webhook_secret
  ) {
    return new Response(
      "Webhook secret belum diatur",
      {
        status: 503,
      }
    );
  }

  const valid =
    await verifySignature(
      body,
      signature,
      settings.webhook_secret
    );

  if (!valid) {
    return new Response(
      "Unauthorized",
      {
        status: 401,
      }
    );
  }

  let data;

  try {
    data =
      JSON.parse(body);
  } catch {
    return new Response(
      "Bad Request",
      {
        status: 400,
      }
    );
  }

  const transactionId =
    data.transaction_id;

  if (!transactionId) {
    return new Response(
      "OK",
      {
        status: 200,
      }
    );
  }

  if (
    data.event ===
    "payment.success"
  ) {
    await processPaymentSuccess(
      env,
      transactionId,
      data
    );
  } else if (
    data.event ===
      "payment.expired" ||
    data.event ===
      "payment.failed"
  ) {
    await supabase(
      env,
      `orders?payment_id=eq.${encodeURIComponent(
        transactionId
      )}`,
      "PATCH",
      {
        status:
          data.event ===
          "payment.expired"
            ? "EXPIRED"
            : "FAILED",
      }
    );
  }

  return new Response(
    "OK",
    {
      status: 200,
    }
  );
}

async function processPaymentSuccess(
  env,
  transactionId,
  data
) {
  /*
   * Update kondisional: hanya baris dengan status masih PENDING
   * yang akan ter-update. Ini mencegah webhook duplikat.
   */
  const updated =
    await supabase(
      env,
      `orders?payment_id=eq.${encodeURIComponent(
        transactionId
      )}&status=eq.PENDING`,
      "PATCH",
      {
        status:
          "PAID",
        paid_at:
          data.paid_at ||
          new Date().toISOString(),
      },
      {
        Prefer:
          "return=representation",
      }
    );

  const order =
    updated?.[0];

  if (!order) {
    return;
  }

  try {
    await deliverProduct(
      env,
      order
    );

    await updateOrder(
      env,
      order.id,
      {
        status:
          "DELIVERED",
      }
    );
  } catch (error) {
    console.error(
      "Gagal mengirim produk setelah pembayaran:",
      error
    );

    await updateOrder(
      env,
      order.id,
      {
        status:
          "DELIVERY_FAILED",
      }
    );
  }
}

async function updateOrder(
  env,
  orderId,
  data
) {
  return supabase(
    env,
    `orders?id=eq.${Number(
      orderId
    )}`,
    "PATCH",
    data
  );
}

/**
 * Membaca seluruh payment settings.
 *
 * payment_secret_token dan payment_webhook_secret
 * mendukung dua format:
 *
 * 1. Format baru:
 *    enc:v1:...
 *
 * 2. Format lama:
 *    plaintext
 *
 * Jika ditemukan plaintext lama,
 * secret langsung dimigrasikan menggunakan
 * setSetting() -> upsertSetting() -> encryptSecret().
 */
async function getPaymentSettings(
  env
) {
  const rows =
    await supabase(
      env,
      "settings?key=like.payment_*&order=key.asc"
    );

  const result = {
    enabled:
      true,
    account_id:
      "",
    secret_token:
      "",
    webhook_secret:
      "",
    qris_method:
      "qris_two",
    test:
      false,
    fee_type:
      "percent",
    fee_value:
      0,
  };

  for (
    const row of
      rows || []
  ) {
    const key =
      String(
        row.key || ""
      );

    const value =
      row.value;

    if (
      key ===
      "payment_enabled"
    ) {
      result.enabled =
        value === true ||
        value === "true" ||
        value === "1";
    }

    if (
      key ===
      "payment_account_id"
    ) {
      result.account_id =
        value || "";
    }

    if (
      key ===
      "payment_secret_token"
    ) {
      if (value) {
        result.secret_token =
          await decryptSecret(
            env,
            value
          );

        /*
         * Auto-migration:
         * jika value belum terenkripsi,
         * simpan ulang melalui upsertSetting().
         */
        if (
          !isEncryptedSecret(value)
        ) {
          await setSetting(
            env,
            "payment_secret_token",
            result.secret_token
          );
        }
      } else {
        result.secret_token =
          "";
      }
    }

    if (
      key ===
      "payment_webhook_secret"
    ) {
      if (value) {
        result.webhook_secret =
          await decryptSecret(
            env,
            value
          );

        /*
         * Auto-migration:
         * jika value belum terenkripsi,
         * simpan ulang melalui upsertSetting().
         */
        if (
          !isEncryptedSecret(value)
        ) {
          await setSetting(
            env,
            "payment_webhook_secret",
            result.webhook_secret
          );
        }
      } else {
        result.webhook_secret =
          "";
      }
    }

    if (
      key ===
      "payment_qris_method"
    ) {
      result.qris_method =
        value ||
        "qris_two";
    }

    if (
      key ===
      "payment_test"
    ) {
      result.test =
        value === true ||
        value === "true" ||
        value === "1";
    }

    if (
      key ===
      "payment_fee_type"
    ) {
      result.fee_type =
        value ||
        "percent";
    }

    if (
      key ===
      "payment_fee_value"
    ) {
      result.fee_value =
        Number(
          value || 0
        );
    }
  }

  return result;
}

async function setSetting(
  env,
  key,
  value
) {
  return upsertSetting(
    env,
    key,
    value
  );
}

function maskValue(
  value
) {
  if (!value) {
    return "Belum diatur";
  }

  const text =
    String(value);

  if (
    text.length <= 6
  ) {
    return "••••••";
  }

  return (
    text.slice(0, 3) +
    "••••••" +
    text.slice(-3)
  );
}

async function verifySignature(
  body,
  signature,
  secret
) {
  if (
    !signature ||
    !secret
  ) {
    return false;
  }

  const expectedPrefix =
    "sha256=";

  if (
    !signature.startsWith(
      expectedPrefix
    )
  ) {
    return false;
  }

  const providedHex =
    signature.slice(
      expectedPrefix.length
    );

  if (
    !/^[a-f0-9]{64}$/i.test(
      providedHex
    )
  ) {
    return false;
  }

  const encoder =
    new TextEncoder();

  const key =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      {
        name:
          "HMAC",
        hash:
          "SHA-256",
      },
      false,
      ["sign"]
    );

  const signatureBuffer =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body)
    );

  const expectedHex =
    Array.from(
      new Uint8Array(
        signatureBuffer
      )
    )
      .map(
        byte =>
          byte
            .toString(16)
            .padStart(
              2,
              "0"
            )
      )
      .join("");

  return timingSafeEqual(
    providedHex.toLowerCase(),
    expectedHex
  );
}

function timingSafeEqual(
  a,
  b
) {
  if (
    a.length !==
    b.length
  ) {
    return false;
  }

  let result = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}

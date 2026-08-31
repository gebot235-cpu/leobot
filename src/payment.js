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
  encryptSecret,
  decryptSecret,
} from "./crypto.js";

/*
 * Endpoint resmi Open API BuatQris.
 */
const BUATQRIS_API =
  "https://app.buatqris.site/api";

/*
 * Endpoint webhook Worker.
 *
 * GANTI bagian domain ini jika Worker Anda memakai
 * custom domain.
 */
const WEBHOOK_PATH =
  "/webhook/buatqris";

/* =========================================================
 * ADMIN PAYMENT MENU
 * ========================================================= */

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

  if (field === "test") {
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

  if (field === "qris_method") {
    const method =
      settings.qris_method === "qris_two"
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

  if (field === "fee") {
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

  const currentlySet =
    field === "account_id"
      ? Boolean(settings.account_id)
      : field === "secret_token"
      ? Boolean(settings.secret_token)
      : Boolean(settings.webhook_secret);

  const buttons = [
    [
      {
        text: "❌ BATAL",
        callback_data:
          "admin:payment:cancel",
      },
    ],
  ];

  if (currentlySet) {
    buttons.unshift([
      {
        text: "🗑️ HAPUS NILAI INI",
        callback_data:
          `admin:payment:setting:clear:${field}`,
      },
    ]);
  }

  return editMessage(
    env,
    chatId,
    messageId,
`🔐 ${labels[field]}

Kirim nilai baru:`,
    buttons
  );
}

export async function confirmClearPaymentSetting(
  env,
  chatId,
  messageId,
  field
) {
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

  const warning =
    field === "webhook_secret"
      ? "⚠️ Kalau WEBHOOK SECRET dihapus, pembayaran otomatis tidak akan berfungsi."
      : field === "secret_token"
      ? "⚠️ Kalau SECRET TOKEN dihapus, bot tidak dapat membuat QRIS baru."
      : "⚠️ Kalau ACCOUNT ID dihapus, pembayaran tidak akan berfungsi.";

  return editMessage(
    env,
    chatId,
    messageId,
`🗑️ HAPUS ${labels[field]}?

${warning}

Yakin mau hapus?`,
    [
      [
        {
          text: "✅ YA, HAPUS",
          callback_data:
            `admin:payment:setting:clear:confirm:${field}`,
        },
      ],
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:payment:setting:${field}`,
        },
      ],
    ]
  );
}

export async function clearPaymentSetting(
  env,
  chatId,
  messageId,
  field
) {
  const keys = {
    account_id:
      "payment_account_id",
    secret_token:
      "payment_secret_token",
    webhook_secret:
      "payment_webhook_secret",
  };

  if (!keys[field]) {
    return;
  }

  await setSetting(
    env,
    keys[field],
    ""
  );

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

  if (state.field === "account_id") {
    await setSetting(
      env,
      "payment_account_id",
      value
    );
  } else if (
    state.field === "secret_token"
  ) {
    await setSetting(
      env,
      "payment_secret_token",
      await encryptSecret(
        env,
        value
      )
    );
  } else if (
    state.field === "webhook_secret"
  ) {
    await setSetting(
      env,
      "payment_webhook_secret",
      await encryptSecret(
        env,
        value
      )
    );
  } else if (
    state.field === "fee"
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
      !Number.isFinite(number) ||
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

/* =========================================================
 * CREATE PAYMENT
 * ========================================================= */

export async function createPayment(
  env,
  telegramId,
  product,
  firstName = null
) {
  const settings =
    await getPaymentSettings(env);

  if (!settings.enabled) {
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

  if (
    !settings.webhook_secret
  ) {
    throw new Error(
      "Webhook Secret belum dikonfigurasi."
    );
  }

  const baseAmount =
    Number(product.price || 0);

  if (
    !Number.isSafeInteger(baseAmount) ||
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
              settings.fee_value || 0
            ) /
            100
      );
  } else {
    amount =
      Math.round(
        baseAmount +
          Number(
            settings.fee_value || 0
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
          Number(telegramId),
        product_id:
          Number(product.id),
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

  const callbackUrl =
    new URL(
      WEBHOOK_PATH,
      "https://"
        + (
          env.WORKER_DOMAIN ||
          "localhost"
        )
    ).toString();

  let response;

  try {
    /*
     * BuatQris mendokumentasikan Content-Type
     * application/x-www-form-urlencoded.
     */
    const form =
      new URLSearchParams();

    form.set(
      "action",
      "api_create_qris"
    );

    form.set(
      "account_id",
      settings.account_id
    );

    form.set(
      "secret_token",
      settings.secret_token
    );

    form.set(
      "amount",
      String(amount)
    );

    form.set(
      "description",
      `Pembayaran order #${orderCode}`
    );

    form.set(
      "qris_method",
      settings.qris_method
    );

    form.set(
      "test",
      settings.test ? "1" : "0"
    );

    /*
     * Callback URL dikirim eksplisit agar transaksi
     * tidak bergantung pada setting callback dashboard.
     *
     * Jika WORKER_DOMAIN tidak tersedia, admin harus
     * mengatur callback_url di dashboard BuatQris.
     */
    if (
      env.WORKER_DOMAIN
    ) {
      form.set(
        "callback_url",
        callbackUrl
      );
    }

    response =
      await fetch(
        BUATQRIS_API,
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body:
            form.toString(),
        }
      );
  } catch (error) {
    console.error(
      "BuatQris request error:",
      error
    );

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
        data?.error ||
        "Gagal membuat QRIS."
    );
  }

  const paymentData =
    data?.data || data;

  const paymentId =
    paymentData?.transaction_id ||
    paymentData?.payment_id ||
    data?.transaction_id ||
    data?.payment_id;

  const qrUrl =
    paymentData?.qr_url ||
    paymentData?.qr_code ||
    data?.qr_url ||
    data?.qr_code;

  const expiresAt =
    paymentData?.expires_at ||
    data?.expires_at ||
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
        String(paymentId),
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
      String(paymentId),
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
  if (!order?.qr_url) {
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

/* =========================================================
 * WEBHOOK
 * ========================================================= */

export async function handleBuatQrisWebhook(
  env,
  request
) {
  /*
   * Penting:
   * signature harus dihitung menggunakan RAW BODY,
   * sebelum JSON.parse().
   */
  const body =
    await request.text();

  const signature =
    request.headers.get(
      "X-BuatQris-Signature"
    );

  const headerEvent =
    request.headers.get(
      "X-BuatQris-Event"
    );

  const settings =
    await getPaymentSettings(env);

  if (
    !settings.webhook_secret
  ) {
    console.error(
      "BuatQris webhook: secret belum dikonfigurasi."
    );

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
    console.error(
      "BuatQris webhook: signature tidak valid."
    );

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

  /*
   * BuatQris mendokumentasikan event di body.
   * Header dipakai sebagai fallback.
   */
  const event =
    data?.event ||
    headerEvent ||
    "";

  const transactionId =
    String(
      data?.transaction_id ||
      data?.data?.transaction_id ||
      data?.payment_id ||
      data?.data?.payment_id ||
      ""
    ).trim();

  if (!transactionId) {
    console.error(
      "BuatQris webhook: transaction_id kosong.",
      data
    );

    /*
     * Jangan retry webhook yang formatnya valid
     * tetapi bukan payment event yang kita perlukan.
     */
    return new Response(
      "OK",
      {
        status: 200,
      }
    );
  }

  console.log(
    "BuatQris webhook:",
    event,
    transactionId
  );

  if (
    event ===
    "payment.success"
  ) {
    await processPaymentSuccess(
      env,
      transactionId,
      data
    );
  } else if (
    event ===
      "payment.expired" ||
    event ===
      "payment.failed"
  ) {
    await processPaymentFailed(
      env,
      transactionId,
      event
    );
  }

  return new Response(
    "OK",
    {
      status: 200,
    }
  );
}

/* =========================================================
 * PAYMENT SUCCESS
 * ========================================================= */

async function processPaymentSuccess(
  env,
  transactionId,
  data
) {
  /*
   * Cari order berdasarkan payment_id.
   */
  const orders =
    (await supabase(
      env,
      `orders?payment_id=eq.${encodeURIComponent(
        transactionId
      )}&limit=1`
    )) || [];

  const order =
    orders?.[0];

  if (!order) {
    console.error(
      "Payment success: order tidak ditemukan:",
      transactionId
    );

    /*
     * Gateway sudah benar mengirim webhook,
     * tetapi order kita tidak ditemukan.
     */
    return;
  }

  /*
   * Jangan proses webhook kedua kali.
   */
  if (
    order.status ===
      "PAID" ||
    order.status ===
      "DELIVERED"
  ) {
    console.log(
      "Payment success: order sudah diproses:",
      order.id
    );

    return;
  }

  /*
   * Validasi nominal.
   *
   * BuatQris:
   * - amount = nominal transaksi QRIS
   * - total_amount = nominal + fee
   *
   * Order bot menyimpan amount sebagai nominal
   * yang harus dibayar user.
   */
  const paidAmount =
    Number(
      data?.amount ??
      data?.data?.amount ??
      0
    );

  const orderAmount =
    Number(
      order.amount || 0
    );

  if (
    !Number.isFinite(paidAmount) ||
    paidAmount <= 0
  ) {
    console.error(
      "Payment success: amount webhook tidak valid:",
      data
    );

    return;
  }

  if (
    paidAmount !==
    orderAmount
  ) {
    console.error(
      "Payment success: nominal tidak cocok.",
      {
        orderId:
          order.id,
        expected:
          orderAmount,
        received:
          paidAmount,
        transactionId,
      }
    );

    /*
     * Jangan otomatis menganggap lunas
     * jika nominal berbeda.
     */
    await updateOrder(
      env,
      order.id,
      {
        status:
          "PAYMENT_MISMATCH",
      }
    );

    return;
  }

  /*
   * Update PENDING -> PAID secara kondisional.
   *
   * Ini penting untuk mencegah dua webhook
   * simultan mengirim produk dua kali.
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
          data?.paid_at ||
          data?.data?.paid_at ||
          new Date().toISOString(),
      },
      {
        Prefer:
          "return=representation",
      }
    );

  const paidOrder =
    updated?.[0];

  if (!paidOrder) {
    /*
     * Kemungkinan webhook duplikat,
     * atau status sudah berubah.
     */
    console.log(
      "Payment success: order sudah tidak PENDING:",
      order.id
    );

    return;
  }

  try {
    await deliverProduct(
      env,
      paidOrder
    );

    await updateOrder(
      env,
      paidOrder.id,
      {
        status:
          "DELIVERED",
      }
    );

    console.log(
      "Payment success: produk berhasil dikirim:",
      paidOrder.id
    );
  } catch (error) {
    console.error(
      "Payment success: gagal mengirim produk:",
      error
    );

    /*
     * Pembayaran sudah benar-benar diterima.
     * Jangan ubah kembali menjadi PENDING.
     */
    await updateOrder(
      env,
      paidOrder.id,
      {
        status:
          "DELIVERY_FAILED",
      }
    );
  }
}

/* =========================================================
 * PAYMENT FAILED / EXPIRED
 * ========================================================= */

async function processPaymentFailed(
  env,
  transactionId,
  event
) {
  const status =
    event ===
      "payment.expired"
      ? "EXPIRED"
      : "FAILED";

  await supabase(
    env,
    `orders?payment_id=eq.${encodeURIComponent(
      transactionId
    )}&status=eq.PENDING`,
    "PATCH",
    {
      status,
    }
  );
}

/* =========================================================
 * ORDER
 * ========================================================= */

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

/* =========================================================
 * SETTINGS
 * ========================================================= */

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

  let encryptedSecretToken =
    "";

  let encryptedWebhookSecret =
    "";

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
      encryptedSecretToken =
        value || "";
    }

    if (
      key ===
      "payment_webhook_secret"
    ) {
      encryptedWebhookSecret =
        value || "";
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

  try {
    result.secret_token =
      await decryptSecret(
        env,
        encryptedSecretToken
      );

    result.webhook_secret =
      await decryptSecret(
        env,
        encryptedWebhookSecret
      );
  } catch (error) {
    console.error(
      "Gagal dekripsi kredensial pembayaran:",
      error
    );

    result.secret_token =
      "";

    result.webhook_secret =
      "";
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

/* =========================================================
 * SIGNATURE
 * ========================================================= */

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

  const prefix =
    "sha256=";

  if (
    !signature
      .toLowerCase()
      .startsWith(prefix)
  ) {
    return false;
  }

  const providedHex =
    signature.slice(
      prefix.length
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
      encoder.encode(
        secret
      ),
      {
        name:
          "HMAC",
        hash:
          "SHA-256",
      },
      false,
      [
        "sign",
      ]
    );

  const signatureBuffer =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(
        body
      )
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

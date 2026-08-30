import {
  sendMessage,
  editMessage,
} from "./telegram.js";

import {
  supabase,
} from "./supabase.js";

const BUATQRIS_API = "https://api.buatqris.site";

export async function showPaymentMenu(
  env,
  chatId,
  messageId
) {
  const settings = await getPaymentSettings(env);

  const text =
`💳 PEMBAYARAN

Status: ${settings.enabled ? "🟢 AKTIF" : "🔴 NONAKTIF"}

QRIS: ${settings.qris_method}

Mode: ${settings.test ? "TEST" : "LIVE"}

Fee: ${settings.fee_type === "percent"
    ? `${settings.fee_value}%`
    : `Rp${Number(settings.fee_value || 0).toLocaleString("id-ID")}`}`;

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text: settings.enabled
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
            "admin:payment:settings",
        },
      ],
      [
        {
          text: "📈 PENDAPATAN",
          callback_data:
            "admin:payment:income",
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

export async function showPaymentSettings(
  env,
  chatId,
  messageId
) {
  const settings = await getPaymentSettings(env);

  return editMessage(
    env,
    chatId,
    messageId,
`⚙️ ATUR PEMBAYARAN

Account ID:
${maskValue(settings.account_id)}

Secret Token:
${settings.secret_token ? "••••••••" : "Belum diatur"}

Webhook Secret:
${settings.webhook_secret ? "••••••••" : "Belum diatur"}

QRIS Method:
${settings.qris_method}

Mode:
${settings.test ? "TEST" : "LIVE"}

Fee:
${settings.fee_type === "percent"
    ? `${settings.fee_value}%`
    : `Rp${Number(settings.fee_value || 0).toLocaleString("id-ID")}`}`,
    [
      [
        {
          text: "🔑 ACCOUNT ID",
          callback_data:
            "admin:payment:field:account_id",
        },
      ],
      [
        {
          text: "🔐 SECRET TOKEN",
          callback_data:
            "admin:payment:field:secret_token",
        },
      ],
      [
        {
          text: "🛡️ WEBHOOK SECRET",
          callback_data:
            "admin:payment:field:webhook_secret",
        },
      ],
      [
        {
          text: "📊 ATUR FEE",
          callback_data:
            "admin:payment:fee",
        },
      ],
      [
        {
          text: "🔄 QRIS METHOD",
          callback_data:
            "admin:payment:method",
        },
      ],
      [
        {
          text: settings.test
            ? "🟢 LIVE MODE"
            : "🧪 TEST MODE",
          callback_data:
            "admin:payment:test",
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

export async function startPaymentFieldEdit(
  env,
  chatId,
  messageId,
  field
) {
  const labels = {
    account_id: "ACCOUNT ID",
    secret_token: "SECRET TOKEN",
    webhook_secret: "WEBHOOK SECRET",
  };

  if (!labels[field]) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type: "EDIT_PAYMENT",
      field,
      message_id: messageId,
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

export async function handlePaymentInput(
  env,
  message,
  state
) {
  const value = message.text?.trim();

  if (!value) {
    return true;
  }

  const allowed = [
    "account_id",
    "secret_token",
    "webhook_secret",
  ];

  if (!allowed.includes(state.field)) {
    return true;
  }

  await setSetting(
    env,
    `payment_${state.field}`,
    value
  );

  await deleteState(
    env,
    message.chat.id
  );

  return showPaymentSettings(
    env,
    message.chat.id,
    state.message_id
  );
}

export async function togglePayment(
  env,
  chatId,
  messageId
) {
  const settings = await getPaymentSettings(env);

  await setSetting(
    env,
    "payment_enabled",
    settings.enabled ? "false" : "true"
  );

  return showPaymentMenu(
    env,
    chatId,
    messageId
  );
}

export async function togglePaymentTest(
  env,
  chatId,
  messageId
) {
  const settings = await getPaymentSettings(env);

  await setSetting(
    env,
    "payment_test",
    settings.test ? "0" : "1"
  );

  return showPaymentSettings(
    env,
    chatId,
    messageId
  );
}

export async function showPaymentFee(
  env,
  chatId,
  messageId
) {
  const settings = await getPaymentSettings(env);

  return editMessage(
    env,
    chatId,
    messageId,
`📊 ATUR FEE

Fee saat ini:
${settings.fee_type === "percent"
    ? `${settings.fee_value}%`
    : `Rp${Number(settings.fee_value || 0).toLocaleString("id-ID")}`}`,
    [
      [
        {
          text: "PERSEN",
          callback_data:
            "admin:payment:fee:type:percent",
        },
      ],
      [
        {
          text: "NOMINAL",
          callback_data:
            "admin:payment:fee:type:fixed",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:payment:settings",
        },
      ],
    ]
  );
}

export async function setPaymentFeeType(
  env,
  chatId,
  messageId,
  type
) {
  if (
    type !== "percent" &&
    type !== "fixed"
  ) {
    return;
  }

  await setSetting(
    env,
    "payment_fee_type",
    type
  );

  await saveState(
    env,
    chatId,
    {
      type: "EDIT_PAYMENT_FEE",
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`📊 ATUR FEE

Jenis:
${type === "percent" ? "Persentase" : "Nominal"}

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

export async function handlePaymentFeeInput(
  env,
  message,
  state
) {
  const value = message.text?.trim();

  if (!/^\d+(\.\d+)?$/.test(value || "")) {
    return true;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return true;
  }

  await setSetting(
    env,
    "payment_fee_value",
    String(number)
  );

  await deleteState(
    env,
    message.chat.id
  );

  return showPaymentSettings(
    env,
    message.chat.id,
    state.message_id
  );
}

export async function setPaymentMethod(
  env,
  chatId,
  messageId
) {
  const settings = await getPaymentSettings(env);

  const method =
    settings.qris_method === "qris_two"
      ? "qris_one"
      : "qris_two";

  await setSetting(
    env,
    "payment_qris_method",
    method
  );

  return showPaymentSettings(
    env,
    chatId,
    messageId
  );
}

export async function cancelPaymentProcess(
  env,
  chatId,
  messageId
) {
  await deleteState(
    env,
    chatId
  );

  return showPaymentSettings(
    env,
    chatId,
    messageId
  );
}

export async function createPayment(
  env,
  telegramId,
  product
) {
  const settings = await getPaymentSettings(env);

  if (
    !settings.enabled ||
    !settings.account_id ||
    !settings.secret_token
  ) {
    throw new Error(
      "Pembayaran belum dikonfigurasi."
    );
  }

  const orderCode =
    `INV-${Date.now()}-${telegramId}`;

  const rows = await supabase(
    env,
    "orders",
    "POST",
    {
      order_code: orderCode,
      telegram_id: Number(telegramId),
      product_id: Number(product.id),
      amount: Number(product.price),
      status: "PENDING",
    },
    {
      Prefer: "return=representation",
    }
  );

  const order = rows?.[0];

  if (!order) {
    throw new Error(
      "Gagal membuat order."
    );
  }

  const response = await fetch(
    BUATQRIS_API,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        action: "api_create_qris",
        account_id:
          settings.account_id,
        secret_token:
          settings.secret_token,
        amount:
          Number(product.price),
        description:
          `Pembayaran order #${orderCode}`,
        qris_method:
          settings.qris_method,
        test:
          settings.test ? 1 : 0,
      }),
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    !data ||
    data.success === false
  ) {
    await updateOrder(
      env,
      order.id,
      {
        status: "FAILED",
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
      Date.now() + 15 * 60 * 1000
    ).toISOString();

  await updateOrder(
    env,
    order.id,
    {
      payment_id:
        paymentId || null,
      qr_url:
        qrUrl || null,
      qr_expires_at:
        expiresAt,
    }
  );

  return {
    ...order,
    payment_id: paymentId,
    qr_url: qrUrl,
    qr_expires_at: expiresAt,
  };
}

export async function sendPaymentQr(
  env,
  chatId,
  order
) {
  if (!order?.qr_url) {
    return;
  }

  return sendMessage(
    env,
    chatId,
    `💳 PEMBAYARAN

Order: ${order.order_code}

Silakan scan QRIS untuk membayar.

⏳ QRIS memiliki batas waktu pembayaran.`
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
    !settings.webhook_secret ||
    !verifySignature(
      body,
      signature,
      settings.webhook_secret
    )
  ) {
    return new Response(
      "Unauthorized",
      {
        status: 401,
      }
    );
  }

  let data;

  try {
    data = JSON.parse(body);
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
    return new Response("OK");
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
  }

  if (
    data.event ===
      "payment.expired" ||
    data.event ===
      "payment.failed"
  ) {
    await supabase(
      env,
      `orders?payment_id=eq.${encodeURIComponent(transactionId)}`,
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
  const rows =
    await supabase(
      env,
      `orders?payment_id=eq.${encodeURIComponent(transactionId)}&limit=1`
    );

  const order = rows?.[0];

  if (!order) {
    return;
  }

  if (order.status === "PAID" ||
      order.status === "COMPLETED") {
    return;
  }

  await updateOrder(
    env,
    order.id,
    {
      status: "PAID",
      paid_at:
        data.paid_at ||
        new Date().toISOString(),
    }
  );

  await processPaidOrder(
    env,
    order
  );
}

async function processPaidOrder(
  env,
  order
) {
  const products =
    await supabase(
      env,
      `products?id=eq.${Number(order.product_id)}&limit=1`
    );

  const product =
    products?.[0];

  if (!product) {
    return;
  }

  if (
    product.type === "DIGITAL"
  ) {
    await updateOrder(
      env,
      order.id,
      {
        status:
          "COMPLETED",
        completed_at:
          new Date().toISOString(),
      }
    );

    return;
  }

  if (
    product.type === "VIP"
  ) {
    await updateOrder(
      env,
      order.id,
      {
        status: "PAID",
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
    `orders?id=eq.${Number(orderId)}`,
    "PATCH",
    data
  );
}

async function getPaymentSettings(
  env
) {
  const rows =
    await supabase(
      env,
      "settings?key=like.payment_*&order=key.asc"
    );

  const result = {
    enabled: true,
    account_id: "",
    secret_token: "",
    webhook_secret: "",
    qris_method: "qris_two",
    test: false,
    fee_type: "percent",
    fee_value: 0,
  };

  for (const row of rows || []) {
    const key =
      String(row.key || "");

    const value =
      row.value;

    if (key === "payment_enabled") {
      result.enabled =
        value === true ||
        value === "true" ||
        value === "1";
    }

    if (key === "payment_account_id") {
      result.account_id =
        value || "";
    }

    if (key === "payment_secret_token") {
      result.secret_token =
        value || "";
    }

    if (key === "payment_webhook_secret") {
      result.webhook_secret =
        value || "";
    }

    if (key === "payment_qris_method") {
      result.qris_method =
        value || "qris_two";
    }

    if (key === "payment_test") {
      result.test =
        value === true ||
        value === "true" ||
        value === "1";
    }

    if (key === "payment_fee_type") {
      result.fee_type =
        value || "percent";
    }

    if (key === "payment_fee_value") {
      result.fee_value =
        Number(value || 0);
    }
  }

  return result;
}

async function setSetting(
  env,
  key,
  value
) {
  return supabase(
    env,
    "settings",
    "POST",
    {
      key,
      value: String(value),
      updated_at:
        new Date().toISOString(),
    },
    {
      Prefer:
        "resolution=merge-duplicates",
    }
  );
}

async function saveState(
  env,
  telegramId,
  state
) {
  return setSetting(
    env,
    `admin_state_${telegramId}`,
    JSON.stringify(state)
  );
}

async function deleteState(
  env,
  telegramId
) {
  return supabase(
    env,
    `settings?key=eq.admin_state_${telegramId}`,
    "DELETE"
  );
}

function maskValue(value) {
  if (!value) {
    return "Belum diatur";
  }

  const text =
    String(value);

  if (text.length <= 6) {
    return "••••••";
  }

  return (
    text.slice(0, 3) +
    "••••••" +
    text.slice(-3)
  );
}

function verifySignature(
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

  return false;
}

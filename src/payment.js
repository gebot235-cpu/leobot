import {
  sendMessage,
  editMessage,
  telegramApi,
} from "./telegram.js";

import {
  supabase,
} from "./supabase.js";

const QRIS_API =
  "https://api.buatqris.site";

export async function createOrder(
  env,
  chatId,
  messageId,
  productId
) {
  const product = await getProduct(
    env,
    productId
  );

  if (
    !product ||
    !product.is_active
  ) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Produk tidak tersedia.",
      [
        [
          {
            text: "◀️ PRODUK",
            callback_data: "user:menu",
          },
        ],
      ]
    );
  }

  const orderCode =
    `INV-${Date.now()}-${chatId}`;

  const rows = await supabase(
    env,
    "orders",
    "POST",
    {
      order_code: orderCode,
      telegram_id: Number(chatId),
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
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Gagal membuat order.",
      [
        [
          {
            text: "◀️ PRODUK",
            callback_data: "user:menu",
          },
        ],
      ]
    );
  }

  try {
    const qris = await createBuatQris(
      env,
      order
    );

    const paymentId =
      qris.payment_id ||
      qris.transaction_id ||
      qris.id ||
      null;

    const qrUrl =
      qris.qr_url ||
      qris.qr_image ||
      qris.qr ||
      null;

    const qrExpiresAt =
      qris.qr_expires_at ||
      qris.expires_at ||
      null;

    if (!paymentId || !qrUrl) {
      throw new Error(
        "Respons BuatQris tidak memiliki payment_id atau qr_url"
      );
    }

    await supabase(
      env,
      `orders?id=eq.${order.id}`,
      "PATCH",
      {
        payment_id:
          String(paymentId),
        qr_url:
          String(qrUrl),
        qr_expires_at:
          qrExpiresAt ||
          new Date(
            Date.now() + 15 * 60 * 1000
          ).toISOString(),
      }
    );

    await sendQrisOnly(
      env,
      chatId,
      qrUrl
    );

    try {
      await telegramApi(
        env,
        "deleteMessage",
        {
          chat_id: chatId,
          message_id: messageId,
        }
      );
    } catch {}

    return;
  } catch (error) {
    console.error(
      "BuatQris error:",
      error
    );

    await supabase(
      env,
      `orders?id=eq.${order.id}`,
      "PATCH",
      {
        status: "FAILED",
      }
    );

    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Gagal membuat QRIS.\n\nSilakan coba lagi.",
      [
        [
          {
            text: "◀️ PRODUK",
            callback_data: "user:menu",
          },
        ],
      ]
    );
  }
}

async function createBuatQris(
  env,
  order
) {
  const response = await fetch(
    QRIS_API,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        action:
          "api_create_qris",

        account_id:
          env.BUATQRIS_ACCOUNT_ID,

        secret_token:
          env.BUATQRIS_SECRET_TOKEN,

        amount:
          Number(order.amount),

        description:
          `Pembayaran order #${order.order_code}`,

        qris_method:
          env.BUATQRIS_QRIS_METHOD ||
          "qris_two",

        test:
          env.BUATQRIS_TEST === "1"
            ? 1
            : 0,
      }),
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      `BuatQris HTTP ${response.status}`
    );
  }

  /*
   * Beberapa API membungkus hasil
   * dalam data/result.
   */
  const result =
    data?.data ||
    data?.result ||
    data;

  if (
    result?.success === false ||
    result?.status === "failed"
  ) {
    throw new Error(
      result?.message ||
      "BuatQris gagal membuat QRIS"
    );
  }

  return result;
}

async function sendQrisOnly(
  env,
  chatId,
  qrUrl
) {
  /*
   * QR dikirim sebagai foto.
   * Tidak ada payment URL,
   * tombol, atau link pembayaran.
   */
  await telegramApi(
    env,
    "sendPhoto",
    {
      chat_id: chatId,
      photo: qrUrl,
      caption:
        "💳 SILAKAN BAYAR QRIS\n\nScan QRIS di atas untuk menyelesaikan pembayaran.",
    }
  );
}

export async function handlePaymentWebhook(
  request,
  env
) {
  const rawBody =
    await request.text();

  const signature =
    request.headers.get(
      "X-BuatQris-Signature"
    );

  if (!signature) {
    return new Response(
      "Unauthorized",
      { status: 401 }
    );
  }

  const secret =
    env.BUATQRIS_WEBHOOK_SECRET;

  if (!secret) {
    console.error(
      "BUATQRIS_WEBHOOK_SECRET belum diatur"
    );

    return new Response(
      "Server configuration error",
      { status: 500 }
    );
  }

  const valid =
    await verifySignature(
      rawBody,
      signature,
      secret
    );

  if (!valid) {
    return new Response(
      "Invalid signature",
      { status: 401 }
    );
  }

  let payload;

  try {
    payload =
      JSON.parse(rawBody);
  } catch {
    return new Response(
      "Invalid JSON",
      { status: 400 }
    );
  }

  const event =
    payload.event;

  if (
    event ===
    "payment.success"
  ) {
    await handlePaymentSuccess(
      env,
      payload
    );
  }

  if (
    event ===
    "payment.expired"
  ) {
    await handlePaymentFailed(
      env,
      payload,
      "EXPIRED"
    );
  }

  if (
    event ===
    "payment.failed"
  ) {
    await handlePaymentFailed(
      env,
      payload,
      "FAILED"
    );
  }

  /*
   * Withdrawal bukan bagian
   * proses order user.
   */
  return new Response(
    "OK",
    { status: 200 }
  );
}

async function handlePaymentSuccess(
  env,
  payload
) {
  const paymentId =
    payload.transaction_id;

  if (!paymentId) {
    return;
  }

  const orders =
    await supabase(
      env,
      `orders?payment_id=eq.${encodeURIComponent(
        paymentId
      )}&limit=1`
    );

  const order =
    orders?.[0];

  if (!order) {
    console.error(
      "Order tidak ditemukan:",
      paymentId
    );

    return;
  }

  /*
   * Idempotent:
   * webhook yang sama tidak
   * boleh memproses order dua kali.
   */
  if (
    order.status === "PAID" ||
    order.status === "COMPLETED"
  ) {
    return;
  }

  const paidAt =
    payload.paid_at ||
    new Date().toISOString();

  await supabase(
    env,
    `orders?id=eq.${order.id}`,
    "PATCH",
    {
      status: "PAID",
      paid_at: paidAt,
    }
  );

  /*
   * Produk belum diproses di sini
   * sampai handler VIP/DIGITAL
   * dihubungkan.
   */
  await processPaidOrder(
    env,
    order
  );
}

async function handlePaymentFailed(
  env,
  payload,
  status
) {
  const paymentId =
    payload.transaction_id;

  if (!paymentId) {
    return;
  }

  const orders =
    await supabase(
      env,
      `orders?payment_id=eq.${encodeURIComponent(
        paymentId
      )}&limit=1`
    );

  const order =
    orders?.[0];

  if (!order) {
    return;
  }

  if (
    order.status ===
      "PAID" ||
    order.status ===
      "COMPLETED"
  ) {
    return;
  }

  await supabase(
    env,
    `orders?id=eq.${order.id}`,
    "PATCH",
    {
      status,
    }
  );
}

async function processPaidOrder(
  env,
  order
) {
  /*
   * Tahap berikutnya:
   *
   * VIP:
   *   buat invite link sekali pakai
   *   expire 12 jam
   *   user masuk channel
   *   subscription mulai dihitung
   *   kick/unban setelah masa aktif
   *
   * DIGITAL:
   *   kirim file/media digital
   *
   * Untuk sekarang order
   * sudah dinyatakan PAID.
   */
  console.log(
    "Payment berhasil:",
    order.order_code
  );
}

async function getProduct(
  env,
  productId
) {
  const rows =
    await supabase(
      env,
      `products?id=eq.${Number(
        productId
      )}&is_active=eq.true&limit=1`
    );

  return rows?.[0] || null;
}

async function verifySignature(
  body,
  signature,
  secret
) {
  const expected =
    await hmacSha256(
      body,
      secret
    );

  return timingSafeEqual(
    expected,
    signature
  );
}

async function hmacSha256(
  body,
  secret
) {
  const encoder =
    new TextEncoder();

  const key =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body)
    );

  const bytes =
    new Uint8Array(signature);

  const hex =
    [...bytes]
      .map(
        (byte) =>
          byte
            .toString(16)
            .padStart(2, "0")
      )
      .join("");

  return `sha256=${hex}`;
}

function timingSafeEqual(
  a,
  b
) {
  if (
    typeof a !== "string" ||
    typeof b !== "string"
  ) {
    return false;
  }

  if (a.length !== b.length) {
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

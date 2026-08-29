import {
  editMessage,
  deleteMessage,
} from "../telegram.js";

import {
  supabase,
} from "../supabase.js";


const messageTypes = {
  welcome: {
    name: "👋 WELCOME",
    key: "message_welcome",
    default:
`🦁 LEOBOT

Selamat datang di toko kami! 👋

Silakan pilih produk:`,
  },

  empty_products: {
    name: "📦 PRODUK KOSONG",
    key: "message_empty_products",
    default:
`🦁 LEOBOT

Saat ini belum ada produk yang tersedia.`,
  },

  product_detail: {
    name: "🧾 DETAIL PRODUK",
    key: "message_product_detail",
    default:
`📦 {product_name}

{description}

💰 Harga: Rp{price}
{duration}`,
  },

  waiting_payment: {
    name: "💳 MENUNGGU BAYAR",
    key: "message_waiting_payment",
    default:
`🧾 ORDER #{order_code}

📦 {product_name}
💰 Rp{price}

Silakan scan QRIS untuk melakukan pembayaran.

⏱️ QRIS berlaku {minutes} menit.`,
  },

  payment_success: {
    name: "✅ PEMBAYARAN BERHASIL",
    key: "message_payment_success",
    default:
`✅ PEMBAYARAN BERHASIL

Terima kasih, {first_name}!`,
  },

  payment_failed: {
    name: "❌ PEMBAYARAN GAGAL",
    key: "message_payment_failed",
    default:
`❌ PEMBAYARAN GAGAL

Pembayaran untuk order #{order_code} tidak berhasil.`,
  },

  vip_active: {
    name: "🔐 VIP AKTIF",
    key: "message_vip_active",
    default:
`🔐 VIP AKTIF

Halo {first_name}!

Akses VIP kamu aktif sampai:
{expires_at}`,
  },

  vip_expired: {
    name: "⏰ VIP BERAKHIR",
    key: "message_vip_expired",
    default:
`⏰ MASA VIP BERAKHIR

Masa aktif VIP kamu telah berakhir.`,
  },

  digital_sent: {
    name: "📦 DIGITAL TERKIRIM",
    key: "message_digital_sent",
    default:
`📦 PRODUK DIGITAL

Halo {first_name}!

Produk kamu sudah dikirim. Terima kasih!`,
  },
};


export async function showMessageMenu(
  env,
  chatId,
  messageId
) {
  return editMessage(
    env,
    chatId,
    messageId,
`✏️ PESAN BOT

Pilih pesan yang ingin diedit:`,

    [
      [
        {
          text: "👋 WELCOME",
          callback_data:
            "admin:message:welcome",
        },
      ],
      [
        {
          text: "📦 PRODUK KOSONG",
          callback_data:
            "admin:message:empty_products",
        },
      ],
      [
        {
          text: "🧾 DETAIL PRODUK",
          callback_data:
            "admin:message:product_detail",
        },
      ],
      [
        {
          text: "💳 MENUNGGU BAYAR",
          callback_data:
            "admin:message:waiting_payment",
        },
      ],
      [
        {
          text: "✅ PEMBAYARAN BERHASIL",
          callback_data:
            "admin:message:payment_success",
        },
      ],
      [
        {
          text: "❌ PEMBAYARAN GAGAL",
          callback_data:
            "admin:message:payment_failed",
        },
      ],
      [
        {
          text: "🔐 VIP AKTIF",
          callback_data:
            "admin:message:vip_active",
        },
      ],
      [
        {
          text: "⏰ VIP BERAKHIR",
          callback_data:
            "admin:message:vip_expired",
        },
      ],
      [
        {
          text: "📦 DIGITAL TERKIRIM",
          callback_data:
            "admin:message:digital_sent",
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


export async function showMessageEditor(
  env,
  chatId,
  messageId,
  type
) {
  const config =
    messageTypes[type];

  if (!config) {
    return;
  }

  const current =
    await getMessage(
      env,
      config.key
    );

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ ${config.name}

Pesan saat ini:

${current}`,

    [
      [
        {
          text: "✏️ EDIT",
          callback_data:
            `admin:message:edit:${type}`,
        },
      ],
      [
        {
          text: "🔄 DEFAULT",
          callback_data:
            `admin:message:default:${type}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:messages",
        },
      ],
    ]
  );
}


export async function startMessageEdit(
  env,
  chatId,
  messageId,
  type
) {
  const config =
    messageTypes[type];

  if (!config) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type: "EDIT_MESSAGE",
      message_type: type,
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT ${config.name}

Kirim pesan baru sekarang.

Placeholder yang tersedia:

{first_name}
{product_name}
{description}
{price}
{duration}
{order_code}
{minutes}
{expires_at}`,

    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:message:${type}`,
        },
      ],
    ]
  );
}


export async function handleMessageInput(
  env,
  message,
  state
) {
  const config =
    messageTypes[
      state.message_type
    ];

  if (!config) {
    return false;
  }

  if (!message.text) {
    return true;
  }

  await setMessage(
    env,
    config.key,
    message.text
  );

  await deleteState(
    env,
    message.from.id
  );

  if (message.message_id) {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );
  }

  await showMessageEditor(
    env,
    message.chat.id,
    state.message_id,
    state.message_type
  );

  return true;
}


export async function restoreDefault(
  env,
  chatId,
  messageId,
  type
) {
  const config =
    messageTypes[type];

  if (!config) {
    return;
  }

  await setMessage(
    env,
    config.key,
    config.default
  );

  return showMessageEditor(
    env,
    chatId,
    messageId,
    type
  );
}


async function getMessage(
  env,
  key
) {
  const rows =
    await supabase(
      env,
      `settings?key=eq.${encodeURIComponent(key)}&limit=1`
    );

  if (
    rows.length > 0 &&
    rows[0].value
  ) {
    return rows[0].value;
  }

  const config =
    Object.values(messageTypes)
      .find(
        (item) => item.key === key
      );

  return config?.default || "";
}


async function setMessage(
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
      value,
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
  return supabase(
    env,
    "settings",
    "POST",
    {
      key:
        `admin_state_${telegramId}`,
      value:
        JSON.stringify(state),
      updated_at:
        new Date().toISOString(),
    },
    {
      Prefer:
        "resolution=merge-duplicates",
    }
  );
}


export async function getState(
  env,
  telegramId
) {
  const rows =
    await supabase(
      env,
      `settings?key=eq.admin_state_${telegramId}&limit=1`
    );

  if (!rows.length) {
    return null;
  }

  try {
    return JSON.parse(
      rows[0].value
    );
  } catch {
    return null;
  }
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

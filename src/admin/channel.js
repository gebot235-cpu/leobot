import {
  editMessage,
  deleteMessage,
  sendMessage,
} from "../telegram.js";

import {
  supabase,
} from "../supabase.js";


export async function showChannelMenu(
  env,
  chatId,
  messageId
) {
  const channels =
    await getChannels(env);

  const buttons = channels.map(
    (channel) => [
      {
        text:
          `${channel.is_active ? "🟢" : "🔴"} ${channel.name || channel.channel_id}`,
        callback_data:
          `admin:channel:view:${channel.id}`,
      },
    ]
  );

  buttons.push([
    {
      text: "➕ TAMBAH CHANNEL",
      callback_data:
        "admin:channel:add",
    },
  ]);

  buttons.push([
    {
      text: "◀️ KEMBALI",
      callback_data:
        "admin:menu",
    },
  ]);

  return editMessage(
    env,
    chatId,
    messageId,
`📢 CHANNEL VIP

Total channel: ${channels.length}

Pilih channel:`,

    buttons
  );
}


export async function startAddChannel(
  env,
  chatId,
  messageId
) {
  await saveState(
    env,
    chatId,
    {
      type: "ADD_CHANNEL",
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`➕ TAMBAH CHANNEL VIP

Kirim Channel ID.

Contoh:
-1001234567890`,

    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:channel",
        },
      ],
    ]
  );
}


export async function handleChannelInput(
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
    !/^-100\d+$/.test(value)
  ) {
    await sendMessage(
      env,
      message.chat.id,
`❌ Channel ID tidak valid.

Gunakan format seperti:

-1001234567890`
    );

    return true;
  }

  const channelId =
    Number(value);

  const chat =
    await telegramRequest(
      env,
      "getChat",
      {
        chat_id:
          channelId,
      }
    );

  if (!chat?.ok) {
    await sendMessage(
      env,
      message.chat.id,
`❌ Channel tidak ditemukan.

Pastikan:
• Channel ID benar
• LeoBot sudah menjadi admin channel`
    );

    return true;
  }

  const admins =
    await telegramRequest(
      env,
      "getChatMember",
      {
        chat_id:
          channelId,
        user_id:
          env.BOT_ID,
      }
    );

  if (!admins?.ok) {
    await sendMessage(
      env,
      message.chat.id,
`⚠️ Channel ditemukan, tetapi status admin bot tidak dapat diperiksa.

Pastikan BOT_ID sudah tersedia di Worker.`
    );

    return true;
  }

  if (
    admins.result.status !==
    "administrator" &&
    admins.result.status !==
    "creator"
  ) {
    await sendMessage(
      env,
      message.chat.id,
`❌ LeoBot bukan admin channel.

Jadikan LeoBot sebagai admin terlebih dahulu.`
    );

    return true;
  }

  const existing =
    await supabase(
      env,
      `vip_channels?channel_id=eq.${channelId}&limit=1`
    );

  if (existing.length) {
    await sendMessage(
      env,
      message.chat.id,
      "⚠️ Channel tersebut sudah terdaftar."
    );

    return true;
  }

  await supabase(
    env,
    "vip_channels",
    "POST",
    {
      channel_id:
        channelId,
      name:
        chat.result.title ||
        "Channel VIP",
      is_active:
        true,
      updated_at:
        new Date().toISOString(),
    }
  );

  await deleteState(
    env,
    message.from.id
  );

  await deleteMessage(
    env,
    message.chat.id,
    message.message_id
  );

  return editMessage(
    env,
    message.chat.id,
    state.message_id,
`✅ CHANNEL TERSIMPAN

📢 ${chat.result.title || "Channel VIP"}

🆔 ${channelId}`,

    [
      [
        {
          text: "📢 CHANNEL VIP",
          callback_data:
            "admin:channel",
        },
      ],
      [
        {
          text: "◀️ ADMIN",
          callback_data:
            "admin:menu",
        },
      ],
    ]
  );
}


async function getChannels(
  env
) {
  return supabase(
    env,
    "vip_channels?order=id.asc"
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


async function telegramRequest(
  env,
  method,
  body
) {
  const response =
    await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body:
          JSON.stringify(body),
      }
    );

  return response.json();
}

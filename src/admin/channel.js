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

Contoh:
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

Pastikan Channel ID benar dan LeoBot sudah menjadi admin channel.`
    );

    return true;
  }

  if (
    chat.result.type !==
    "channel"
  ) {
    await sendMessage(
      env,
      message.chat.id,
      "❌ ID tersebut bukan channel Telegram."
    );

    return true;
  }

  const me =
    await telegramRequest(
      env,
      "getMe",
      {}
    );

  if (!me?.ok) {
    await sendMessage(
      env,
      message.chat.id,
      "❌ Gagal membaca data bot."
    );

    return true;
  }

  const member =
    await telegramRequest(
      env,
      "getChatMember",
      {
        chat_id:
          channelId,
        user_id:
          me.result.id,
      }
    );

  if (!member?.ok) {
    await sendMessage(
      env,
      message.chat.id,
`❌ Gagal memeriksa status LeoBot.

Pastikan LeoBot sudah menjadi admin channel.`
    );

    return true;
  }

  if (
    member.result.status !==
      "administrator" &&
    member.result.status !==
      "creator"
  ) {
    await sendMessage(
      env,
      message.chat.id,
`❌ LeoBot bukan admin channel.

Tambahkan LeoBot sebagai admin terlebih dahulu.`
    );

    return true;
  }

  const existing =
    await supabase(
      env,
      `vip_channels?channel_id=eq.${channelId}&limit=1`
    );

  if (
    existing &&
    existing.length > 0
  ) {
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
`⚠️ CHANNEL SUDAH TERDAFTAR

📢 ${existing[0].name || "Channel VIP"}

🆔 ${existing[0].channel_id}`,

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
        },
      ]
    );
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
      created_at:
        new Date().toISOString(),
      updated_at:
        new Date().toISOString(),
    }
  );

  const saved =
    await supabase(
      env,
      `vip_channels?channel_id=eq.${channelId}&limit=1`
    );

  if (
    !saved ||
    saved.length === 0
  ) {
    await sendMessage(
      env,
      message.chat.id,
      "❌ Channel gagal disimpan ke database."
    );

    return true;
  }

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

📢 ${saved[0].name || "Channel VIP"}

🆔 ${saved[0].channel_id}`,

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

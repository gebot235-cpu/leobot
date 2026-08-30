export async function telegramApi(env, method, data = {}) {
  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      `Telegram API error: ${result.description || "Unknown error"}`
    );
  }

  return result.result;
}

export async function sendMessage(
  env,
  chatId,
  text,
  inlineKeyboard = null
) {
  const data = {
    chat_id: chatId,
    text,
  };

  if (inlineKeyboard) {
    data.reply_markup = {
      inline_keyboard: inlineKeyboard,
    };
  }

  return telegramApi(
    env,
    "sendMessage",
    data
  );
}

export async function sendPhoto(
  env,
  chatId,
  photo,
  caption = null
) {
  const data = {
    chat_id: chatId,
    photo,
  };

  if (caption) {
    data.caption = caption;
  }

  return telegramApi(
    env,
    "sendPhoto",
    data
  );
}

/**
 * Peta jenis media Telegram ke method Bot API dan
 * nama field body yang sesuai. Dipakai untuk mengirim
 * ulang file produk digital sesuai jenis aslinya.
 */
const MEDIA_TYPE_MAP = {
  document: {
    method: "sendDocument",
    field: "document",
  },
  photo: {
    method: "sendPhoto",
    field: "photo",
  },
  video: {
    method: "sendVideo",
    field: "video",
  },
  audio: {
    method: "sendAudio",
    field: "audio",
  },
  voice: {
    method: "sendVoice",
    field: "voice",
  },
  animation: {
    method: "sendAnimation",
    field: "animation",
  },
  video_note: {
    method: "sendVideoNote",
    field: "video_note",
  },
  sticker: {
    method: "sendSticker",
    field: "sticker",
  },
};

/**
 * Kirim file_id sesuai jenis medianya. Jika jenis tidak
 * diketahui (mis. produk lama sebelum kolom file_type ada),
 * fallback ke sendDocument yang paling fleksibel.
 */
export async function sendMediaByType(
  env,
  chatId,
  fileId,
  fileType,
  caption = null
) {
  const config =
    MEDIA_TYPE_MAP[fileType] ||
    MEDIA_TYPE_MAP.document;

  const data = {
    chat_id: chatId,
    [config.field]: fileId,
  };

  if (caption) {
    data.caption = caption;
  }

  return telegramApi(
    env,
    config.method,
    data
  );
}

/**
 * Buat invite link sekali-pakai untuk sebuah channel/group.
 * member_limit: 1 memastikan link tidak bisa dipakai ulang
 * oleh orang lain setelah dipakai sekali.
 */
export async function createSingleUseInviteLink(
  env,
  channelId,
  name = null
) {
  const data = {
    chat_id: channelId,
    member_limit: 1,
    creates_join_request: false,
  };

  if (name) {
    data.name = name.slice(0, 32);
  }

  return telegramApi(
    env,
    "createChatInviteLink",
    data
  );
}

/**
 * "Kick" user dari channel/group tanpa memban permanen:
 * ban lalu langsung unban supaya user bisa join lagi nanti
 * kalau berlangganan ulang, tapi keluar dari channel sekarang.
 */
export async function kickChatMember(
  env,
  channelId,
  userId
) {
  await telegramApi(
    env,
    "banChatMember",
    {
      chat_id: channelId,
      user_id: userId,
    }
  );

  return telegramApi(
    env,
    "unbanChatMember",
    {
      chat_id: channelId,
      user_id: userId,
      only_if_banned: true,
    }
  );
}

export async function editMessage(
  env,
  chatId,
  messageId,
  text,
  inlineKeyboard = null
) {
  const data = {
    chat_id: chatId,
    message_id: messageId,
    text,
  };

  if (inlineKeyboard) {
    data.reply_markup = {
      inline_keyboard: inlineKeyboard,
    };
  } else {
    data.reply_markup = {
      inline_keyboard: [],
    };
  }

  return telegramApi(
    env,
    "editMessageText",
    data
  );
}

export async function deleteMessage(
  env,
  chatId,
  messageId
) {
  return telegramApi(
    env,
    "deleteMessage",
    {
      chat_id: chatId,
      message_id: messageId,
    }
  );
}

export async function answerCallback(
  env,
  callbackId,
  text = null
) {
  const data = {
    callback_query_id: callbackId,
  };

  if (text) {
    data.text = text;
  }

  return telegramApi(
    env,
    "answerCallbackQuery",
    data
  );
}

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

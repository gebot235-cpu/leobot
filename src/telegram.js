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

  return telegramApi(env, "sendMessage", data);
}

export async function answerCallback(env, callbackId) {
  return telegramApi(env, "answerCallbackQuery", {
    callback_query_id: callbackId,
  });
}

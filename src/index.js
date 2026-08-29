import {
  showMainMenu,
  showProduct,
} from "./user/menu.js";

import {
  answerCallback,
} from "./telegram.js";


export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      request.method === "GET" &&
      url.pathname === "/"
    ) {
      return new Response(
        "LeoBot is online ✅"
      );
    }

    if (
      request.method === "POST" &&
      url.pathname === "/telegram"
    ) {
      try {
        const update =
          await request.json();

        await handleUpdate(
          update,
          env
        );

        return new Response("OK");
      } catch (error) {
        console.error(error);

        return new Response("OK");
      }
    }

    return new Response(
      "Not Found",
      { status: 404 }
    );
  },
};


async function handleUpdate(
  update,
  env
) {
  if (update.message) {
    await handleMessage(
      update.message,
      env
    );
  }

  if (update.callback_query) {
    await handleCallback(
      update.callback_query,
      env
    );
  }
}


async function handleMessage(
  message,
  env
) {
  const chatId =
    message.chat.id;

  const text =
    message.text || "";

  if (text === "/start") {
    await showMainMenu(
      env,
      chatId
    );
  }
}


async function handleCallback(
  callback,
  env
) {
  const data =
    callback.data || "";

  await answerCallback(
    env,
    callback.id
  );

  if (
    data.startsWith("product:")
  ) {
    const productId =
      data.split(":")[1];

    await showProduct(
      env,
      callback.message.chat.id,
      productId
    );
  }
}

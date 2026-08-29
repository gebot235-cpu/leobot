import {
  showMainMenu,
  showProduct,
} from "./user/menu.js";

import {
  answerCallback,
  sendMessage,
} from "./telegram.js";

import {
  isAdmin,
  showAdminMenu,
} from "./admin/menu.js";

import {
  showAdminProducts,
} from "./admin/products.js";


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
    return;
  }

  if (text === "/admin") {
    if (
      await isAdmin(
        env,
        message.from.id
      )
    ) {
      await showAdminMenu(
        env,
        chatId
      );
    } else {
      await sendMessage(
        env,
        chatId,
        "❌ Akses ditolak."
      );
    }
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

  const chatId =
    callback.message.chat.id;

  const telegramId =
    callback.from.id;

  if (data === "admin:menu") {
    if (
      await isAdmin(
        env,
        telegramId
      )
    ) {
      await showAdminMenu(
        env,
        chatId
      );
    }

    return;
  }

  if (data === "admin:products") {
    if (
      await isAdmin(
        env,
        telegramId
      )
    ) {
      await showAdminProducts(
        env,
        chatId
      );
    }

    return;
  }

  if (
    data.startsWith("product:")
  ) {
    const productId =
      data.split(":")[1];

    await showProduct(
      env,
      chatId,
      productId
    );
  }
}

import {
  showMainMenu,
  showProduct,
} from "./user/menu.js";

import {
  sendMessage,
  answerCallback,
} from "./telegram.js";

import {
  isAdmin,
  showAdminMenu,
} from "./admin/menu.js";

import {
  showAdminProducts,
  showProductList,
} from "./admin/products.js";

import {
  showMessageMenu,
  showMessageEditor,
  startMessageEdit,
  handleMessageInput,
  restoreDefault,
  getState,
} from "./admin/messages.js";


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

  const telegramId =
    message.from.id;

  const text =
    message.text || "";

  const state =
    await getState(
      env,
      telegramId
    );

  if (
    state &&
    state.type === "EDIT_MESSAGE"
  ) {
    const admin =
      await isAdmin(
        env,
        telegramId
      );

    if (admin) {
      await handleMessageInput(
        env,
        message,
        state
      );

      return;
    }
  }

  if (text === "/start") {
    await showMainMenu(
      env,
      chatId
    );

    return;
  }

  if (text === "/admin") {
    const admin =
      await isAdmin(
        env,
        telegramId
      );

    if (!admin) {
      await sendMessage(
        env,
        chatId,
        "❌ Akses ditolak."
      );

      return;
    }

    await sendMessage(
      env,
      chatId,
`👑 LEOBOT ADMIN

Kelola toko:`,

      [
        [
          {
            text: "📦 PRODUK",
            callback_data:
              "admin:products",
          },
        ],
        [
          {
            text: "💳 PEMBAYARAN",
            callback_data:
              "admin:payment",
          },
        ],
        [
          {
            text: "📢 CHANNEL VIP",
            callback_data:
              "admin:channel",
          },
        ],
        [
          {
            text: "✏️ PESAN BOT",
            callback_data:
              "admin:messages",
          },
        ],
        [
          {
            text: "⚙️ PENGATURAN",
            callback_data:
              "admin:settings",
          },
        ],
      ]
    );

    return;
  }
}


async function handleCallback(
  callback,
  env
) {
  const data =
    callback.data || "";

  const chatId =
    callback.message.chat.id;

  const messageId =
    callback.message.message_id;

  const telegramId =
    callback.from.id;

  await answerCallback(
    env,
    callback.id
  );

  if (
    data.startsWith("admin:")
  ) {
    const admin =
      await isAdmin(
        env,
        telegramId
      );

    if (!admin) {
      return;
    }
  }

  if (data === "admin:menu") {
    await showAdminMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (data === "admin:products") {
    await showAdminProducts(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:product:list"
  ) {
    await showProductList(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data === "admin:messages"
  ) {
    await showMessageMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data.startsWith(
      "admin:message:edit:"
    )
  ) {
    const type =
      data.replace(
        "admin:message:edit:",
        ""
      );

    await startMessageEdit(
      env,
      chatId,
      messageId,
      type
    );

    return;
  }

  if (
    data.startsWith(
      "admin:message:default:"
    )
  ) {
    const type =
      data.replace(
        "admin:message:default:",
        ""
      );

    await restoreDefault(
      env,
      chatId,
      messageId,
      type
    );

    return;
  }

  if (
    data.startsWith(
      "admin:message:"
    )
  ) {
    const type =
      data.replace(
        "admin:message:",
        ""
      );

    await showMessageEditor(
      env,
      chatId,
      messageId,
      type
    );

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
      messageId,
      productId
    );

    return;
  }

  if (data === "user:menu") {
    await showMainMenu(
      env,
      chatId,
      messageId
    );

    return;
  }
}

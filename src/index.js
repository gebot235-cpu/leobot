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


export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (
      request.method === "GET" &&
      url.pathname === "/"
    ) {
      return new Response(
        "LeoBot is online ✅",
        {
          status: 200,
          headers: {
            "content-type":
              "text/plain; charset=UTF-8",
          },
        }
      );
    }

    // Telegram webhook
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
        console.error(
          "Webhook error:",
          error
        );

        // Tetap balas OK ke Telegram
        // supaya Telegram tidak terus
        // mengirim ulang update.
        return new Response("OK");
      }
    }

    return new Response(
      "Not Found",
      {
        status: 404,
      }
    );
  },
};


/*
|--------------------------------------------------------------------------
| UPDATE HANDLER
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| MESSAGE HANDLER
|--------------------------------------------------------------------------
*/

async function handleMessage(
  message,
  env
) {
  const chatId =
    message.chat.id;

  const text =
    message.text || "";

  /*
  |--------------------------------------------------------------------------
  | USER
  |--------------------------------------------------------------------------
  */

  if (text === "/start") {
    await showMainMenu(
      env,
      chatId
    );

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | ADMIN
  |--------------------------------------------------------------------------
  */

  if (text === "/admin") {
    const admin =
      await isAdmin(
        env,
        message.from.id
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


/*
|--------------------------------------------------------------------------
| CALLBACK HANDLER
|--------------------------------------------------------------------------
*/

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


  /*
  |--------------------------------------------------------------------------
  | STOP LOADING BUTTON
  |--------------------------------------------------------------------------
  */

  await answerCallback(
    env,
    callback.id
  );


  /*
  |--------------------------------------------------------------------------
  | ADMIN MENU
  |--------------------------------------------------------------------------
  */

  if (data === "admin:menu") {
    const admin =
      await isAdmin(
        env,
        telegramId
      );

    if (!admin) {
      return;
    }

    await showAdminMenu(
      env,
      chatId,
      messageId
    );

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | ADMIN PRODUCTS
  |--------------------------------------------------------------------------
  */

  if (data === "admin:products") {
    const admin =
      await isAdmin(
        env,
        telegramId
      );

    if (!admin) {
      return;
    }

    await showAdminProducts(
      env,
      chatId,
      messageId
    );

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | ADMIN PRODUCT LIST
  |--------------------------------------------------------------------------
  */

  if (
    data ===
    "admin:product:list"
  ) {
    const admin =
      await isAdmin(
        env,
        telegramId
      );

    if (!admin) {
      return;
    }

    await showProductList(
      env,
      chatId,
      messageId
    );

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | USER PRODUCT
  |--------------------------------------------------------------------------
  */

  if (
    data.startsWith(
      "product:"
    )
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
}

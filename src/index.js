import {
  sendMessage,
  editMessage,
  answerCallback,
} from "./telegram.js";

import {
  isAdmin,
  showAdminMenu,
} from "./admin/menu.js";

import {
  showChannelMenu,
  startAddChannel,
  handleChannelInput,
} from "./admin/channel.js";

import {
  showMessageMenu,
  showMessageEditor,
  startMessageEdit,
  handleMessageInput,
  restoreDefault,
  getState,
} from "./admin/messages.js";

import {
  showAdminProducts,
  showProductList,
  showProductDetail,
  showProductEdit,
  startProductFieldEdit,
  handleProductInput,
  startAddProduct,
  selectAddProductType,
  handleAddProductInput,
  skipDescription,
  toggleProductChannel,
  saveProductChannels,
  saveNewProduct,
  showProductChannels,
  toggleEditProductChannel,
  saveEditProductChannels,
  toggleProduct,
  confirmDeleteProduct,
  deleteProduct,
  cancelProductProcess,
  cancelEditProductChannels,
} from "./admin/products.js";

import {
  showMainMenu,
  showProduct,
} from "./user/menu.js";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("OK");
    }

    let update;

    try {
      update = await request.json();
    } catch {
      return new Response("Bad Request", {
        status: 400,
      });
    }

    try {
      if (update.callback_query) {
        await handleCallback(
          env,
          update.callback_query
        );
      } else if (update.message) {
        await handleMessage(
          env,
          update.message
        );
      }
    } catch (error) {
      console.error(error);
    }

    return new Response("OK");
  },
};

async function handleMessage(
  env,
  message
) {
  const chatId =
    message.chat?.id;

  const text =
    message.text?.trim();

  if (!chatId) {
    return;
  }

  /*
   * /admin selalu diproses lebih dulu.
   * State proses sebelumnya tidak boleh
   * membuat /admin dianggap sebagai input.
   */
  if (text === "/admin") {
    if (!(await isAdmin(env, chatId))) {
      await sendMessage(
        env,
        chatId,
        "❌ Kamu bukan admin."
      );

      return;
    }

    await showAdminMenuAsNewMessage(
      env,
      chatId
    );

    return;
  }

  const state =
    await getState(
      env,
      chatId
    );

  if (!state) {
    if (text === "/start") {
      await showMainMenu(
        env,
        chatId
      );
    }

    return;
  }

  /*
   * Command lain juga tidak boleh
   * tertelan oleh state input.
   */
  if (
    text &&
    text.startsWith("/")
  ) {
    return;
  }

  if (
    state.type ===
    "EDIT_PRODUCT"
  ) {
    await handleProductInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "ADD_PRODUCT"
  ) {
    await handleAddProductInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "ADD_CHANNEL"
  ) {
    await handleChannelInput(
      env,
      message,
      state
    );

    return;
  }

  if (
    state.type ===
    "EDIT_MESSAGE"
  ) {
    await handleMessageInput(
      env,
      message,
      state
    );
  }
}

async function showAdminMenuAsNewMessage(
  env,
  chatId
) {
  const sent =
    await sendMessage(
      env,
      chatId,
      "👑 LEOBOT ADMIN\n\nKelola toko:",
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
      ]
    );

  /*
   * Jika ada state lama, jangan gunakan
   * state.message_id untuk /admin.
   *
   * /admin harus membuka menu baru dan
   * tetap bisa digunakan kapan saja.
   */
  return sent;
}

async function handleCallback(
  env,
  callback
) {
  const data =
    callback.data || "";

  const message =
    callback.message;

  const chatId =
    message?.chat?.id;

  const messageId =
    message?.message_id;

  try {
    await answerCallback(
      env,
      callback.id
    );
  } catch {
  }

  if (
    !chatId ||
    !messageId
  ) {
    return;
  }

  /*
   * USER
   */
  if (
    data ===
    "user:menu"
  ) {
    await showMainMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

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

  /*
   * ADMIN
   */
  if (
    !data.startsWith(
      "admin:"
    )
  ) {
    return;
  }

  if (
    !(await isAdmin(
      env,
      chatId
    ))
  ) {
    return;
  }

  const parts =
    data.split(":");

  /*
   * ADMIN MENU
   */
  if (
    data ===
    "admin:menu"
  ) {
    await showAdminMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  /*
   * PRODUCTS
   */
  if (
    data ===
    "admin:products"
  ) {
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
    data ===
    "admin:product:add"
  ) {
    await startAddProduct(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "add" &&
    parts[3] === "type"
  ) {
    await selectAddProductType(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    data ===
    "admin:product:add:skip:description"
  ) {
    await skipDescription(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:product:add:save"
  ) {
    await saveNewProduct(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "view"
  ) {
    await showProductDetail(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "edit"
  ) {
    await showProductEdit(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "field"
  ) {
    await startProductFieldEdit(
      env,
      chatId,
      messageId,
      parts[4],
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "toggle"
  ) {
    await toggleProduct(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "delete" &&
    parts[3] !== "confirm"
  ) {
    await confirmDeleteProduct(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "delete-confirm"
  ) {
    await deleteProduct(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  /*
   * BATAL EDIT PRODUCT
   *
   * admin:product:cancel
   * admin:product:cancel:123
   */
  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "cancel"
  ) {
    await cancelProductProcess(
      env,
      chatId,
      messageId,
      parts[3] || null
    );

    return;
  }

  /*
   * ADD PRODUCT CHANNEL
   */
  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "channel" &&
    parts[3] === "toggle"
  ) {
    await toggleProductChannel(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    data ===
    "admin:product:channels:save"
  ) {
    await saveProductChannels(
      env,
      chatId,
      messageId
    );

    return;
  }

  /*
   * EDIT PRODUCT CHANNELS
   */
  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "channels"
  ) {
    await showProductChannels(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "editchannel" &&
    parts[3] === "toggle"
  ) {
    await toggleEditProductChannel(
      env,
      chatId,
      messageId,
      parts[4],
      parts[5]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "editchannel" &&
    parts[3] === "save"
  ) {
    await saveEditProductChannels(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "product" &&
    parts[2] === "editchannel" &&
    parts[3] === "cancel"
  ) {
    await cancelEditProductChannels(
      env,
      chatId,
      messageId,
      parts[4]
    );

    return;
  }

  /*
   * CHANNEL
   */
  if (
    data ===
    "admin:channel"
  ) {
    await showChannelMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:channel:add"
  ) {
    await startAddChannel(
      env,
      chatId,
      messageId
    );

    return;
  }

  /*
   * MESSAGES
   */
  if (
    data ===
    "admin:messages"
  ) {
    await showMessageMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "message" &&
    parts[2] === "edit"
  ) {
    await startMessageEdit(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "message" &&
    parts[2] === "default"
  ) {
    await restoreDefault(
      env,
      chatId,
      messageId,
      parts[3]
    );

    return;
  }

  if (
    parts[0] === "admin" &&
    parts[1] === "message" &&
    parts.length === 3
  ) {
    await showMessageEditor(
      env,
      chatId,
      messageId,
      parts[2]
    );

    return;
  }

  /*
   * MENU YANG BELUM MEMILIKI HANDLER
   */
  if (
    data === "admin:payment" ||
    data === "admin:settings"
  ) {
    await editMessage(
      env,
      chatId,
      messageId,
      "⚠️ Menu ini belum tersedia.",
      [
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
}

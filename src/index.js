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
  showProductDetail,
  showProductEdit,
  startProductFieldEdit,
  handleProductInput,
  toggleProduct,
  confirmDeleteProduct,
  deleteProduct,
  startAddProduct,
  selectAddProductType,
  handleAddProductInput,
  skipDescription,
  saveNewProduct,
  showProductChannels,
  toggleProductChannel,
  saveProductChannels,
  toggleEditProductChannel,
  saveEditProductChannels,
} from "./admin/products.js";

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
  supabase,
} from "./supabase.js";


export default {
  async fetch(request, env) {
    const url =
      new URL(request.url);

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

  if (state) {
    const admin =
      await isAdmin(
        env,
        telegramId
      );

    if (admin) {
      if (
        state.type ===
        "EDIT_MESSAGE"
      ) {
        await handleMessageInput(
          env,
          message,
          state
        );

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

    await showAdminMenu(
      env,
      chatId
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

  if (
    data ===
    "admin:cancel"
  ) {
    await clearState(
      env,
      telegramId
    );

    await showAdminMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:product:cancel"
  ) {
    await clearState(
      env,
      telegramId
    );

    await showAdminProducts(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:menu"
  ) {
    await clearState(
      env,
      telegramId
    );

    await showAdminMenu(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data ===
    "admin:products"
  ) {
    await clearState(
      env,
      telegramId
    );

    await showAdminProducts(
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
    data ===
    "admin:product:list"
  ) {
    await clearState(
      env,
      telegramId
    );

    await showProductList(
      env,
      chatId,
      messageId
    );

    return;
  }

  if (
    data.startsWith(
      "admin:product:add:type:"
    )
  ) {
    const type =
      data.replace(
        "admin:product:add:type:",
        ""
      );

    await selectAddProductType(
      env,
      chatId,
      messageId,
      type
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
    data ===
    "admin:product:channels:select"
  ) {
    await showProductChannels(
      env,
      chatId,
      messageId,
      await getStateProductId(
        env,
        telegramId
      )
    );

    return;
  }

  if (
    data.startsWith(
      "admin:product:channel:toggle:"
    )
  ) {
    const channelId =
      data.replace(
        "admin:product:channel:toggle:",
        ""
      );

    await toggleProductChannel(
      env,
      chatId,
      messageId,
      channelId
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

  if (
    data.startsWith(
      "admin:product:editchannel:toggle:"
    )
  ) {
    const parts =
      data.split(":");

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
    data.startsWith(
      "admin:product:editchannel:save:"
    )
  ) {
    const productId =
      data.split(":")[4];

    await saveEditProductChannels(
      env,
      chatId,
      messageId,
      productId
    );

    return;
  }

  if (
    data.startsWith(
      "admin:product:view:"
    )
  ) {
    const productId =
      data.replace(
        "admin:product:view:",
        ""
      );

    await clearState(
      env,
      telegramId
    );

    await showProductDetail(
      env,
      chatId,
      messageId,
      productId
    );

    return;
  }

  if (
    data.startsWith(
      "admin:product:edit:"
    )
  ) {
    const productId =
      data.replace(
        "admin:product:edit:",
        ""
      );

    await clearState(
      env,
      telegramId
    );

    await showProductEdit(
      env,
      chatId,
      messageId,
      productId
    );

    return;
  }

  if (
    data.startsWith(
      "admin:product:field:"
    )
  ) {
    const parts =
      data.split(":");

    await startProductFieldEdit(
      env,
      chatId,
      messageId,
      parts[3],
      parts[4]
    );

    return;
  }

  if (
    data.startsWith(
      "admin:product:toggle:"
    )
  ) {
    const productId =
      data.replace(
        "admin:product:toggle:",
        ""
      );

    await toggleProduct(
      env,
      chatId,
      messageId,
      productId
    );

    return;
  }

  if (
    data.startsWith(
      "admin:product:delete-confirm:"
    )
  ) {
    const productId =
      data.replace(
        "admin:product:delete-confirm:",
        ""
      );

    await deleteProduct(
      env,
      chatId,
      messageId,
      productId
    );

    return;
  }

  if (
    data.startsWith(
      "admin:product:delete:"
    )
  ) {
    const productId =
      data.replace(
        "admin:product:delete:",
        ""
      );

    await confirmDeleteProduct(
      env,
      chatId,
      messageId,
      productId
    );

    return;
  }

  if (
    data ===
    "admin:channel"
  ) {
    await clearState(
      env,
      telegramId
    );

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

  if (
    data ===
    "admin:messages"
  ) {
    await clearState(
      env,
      telegramId
    );

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

  if (
    data === "user:menu"
  ) {
    await showMainMenu(
      env,
      chatId,
      messageId
    );

    return;
  }
}


async function clearState(
  env,
  telegramId
) {
  return supabase(
    env,
    `settings?key=eq.admin_state_${telegramId}`,
    "DELETE"
  );
}


async function getStateProductId(
  env,
  telegramId
) {
  const state =
    await getState(
      env,
      telegramId
    );

  return state?.product_id;
}

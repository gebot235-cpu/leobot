import {
  sendMessage,
  sendPhoto,
  editMessage,
} from "../telegram.js";

import {
  getActiveProducts,
  getProduct,
} from "../products/products.js";

import {
  getShopSettings,
  formatPriceDigits,
} from "../settings.js";

import {
  getMessage,
} from "../admin/messages.js";


export async function showMainMenu(
  env,
  chatId,
  messageId = null
) {
  const [products, settings] =
    await Promise.all([
      getActiveProducts(env),
      getShopSettings(env),
    ]);

  const text =
`🦁 LEOBOT

Selamat datang di toko kami! 👋

Silakan pilih produk:`;

  const buttons =
    products.map((product) => [
      {
        text:
          `${product.type === "VIP" ? "🟢" : "📦"} ${product.name}`,
        callback_data:
          `product:${product.id}`,
      },
    ]);

  if (settings.cs_contact) {
    buttons.push([
      {
        text: "📞 HUBUNGI CS",
        callback_data: "user:cs",
      },
    ]);
  }

  if (buttons.length === 0) {
    const emptyText =
`${text}

Saat ini belum ada produk yang tersedia.`;

    if (messageId) {
      return editMessage(
        env,
        chatId,
        messageId,
        emptyText
      );
    }

    return sendMessage(
      env,
      chatId,
      emptyText
    );
  }

  if (messageId) {
    /*
     * Telegram tidak bisa mengubah pesan teks jadi pesan foto
     * (dan sebaliknya) lewat editMessageText, jadi banner welcome
     * hanya tampil saat mengirim pesan baru (mis. /start), bukan
     * saat navigasi "kembali" ke menu yang sudah ada.
     */
    return editMessage(
      env,
      chatId,
      messageId,
      text,
      buttons
    );
  }

  if (settings.welcome_photo) {
    return sendPhoto(
      env,
      chatId,
      settings.welcome_photo,
      text,
      buttons
    );
  }

  return sendMessage(
    env,
    chatId,
    text,
    buttons
  );
}


export async function showCsContact(
  env,
  chatId,
  messageId
) {
  const settings =
    await getShopSettings(env);

  return editMessage(
    env,
    chatId,
    messageId,
`📞 KONTAK CS

${settings.cs_contact || "Belum ada kontak CS yang diatur."}`,
    [
      [
        {
          text: settings.btn_back_label,
          callback_data: "user:menu",
        },
      ],
    ]
  );
}


export async function showProduct(
  env,
  chatId,
  messageId,
  productId
) {
  const [product, settings] =
    await Promise.all([
      getProduct(env, productId),
      getShopSettings(env),
    ]);

  if (
    !product ||
    !product.is_active
  ) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Produk tidak tersedia.",
      [
        [
          {
            text: settings.btn_back_label,
            callback_data:
              "user:menu",
          },
        ],
      ]
    );
  }

  let text =
    await getMessage(
      env,
      "message_product_detail"
    );

  text = text
    .replaceAll(
      "{product_name}",
      product.name || ""
    )
    .replaceAll(
      "{description}",
      product.description || ""
    )
    .replaceAll(
      "{price}",
      formatPriceDigits(product.price, settings)
    )
    .replaceAll(
      "{duration}",
      product.type === "VIP"
        ? `⏳ Masa aktif: ${product.duration_days} hari`
        : ""
    );

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text: settings.btn_pay_label,
          callback_data:
            `order:create:${product.id}`,
        },
      ],
      [
        {
          text: settings.btn_back_label,
          callback_data:
            "user:menu",
        },
      ],
    ]
  );
}

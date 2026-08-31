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

  const text = await getMessage(
  env,
  "message_welcome"
);

  const buttons = [];

  /*
   * VIP ditampilkan terlebih dahulu.
   */
  if (
    products.some(
      (product) =>
        product.type === "VIP"
    )
  ) {
    buttons.push([
      {
        text:
          "🔐 PRODUK VIP",
        callback_data:
          "user:category:vip",
      },
    ]);
  }

  /*
   * DIGITAL ditampilkan setelah VIP.
   */
  if (
    products.some(
      (product) =>
        product.type === "DIGITAL"
    )
  ) {
    buttons.push([
      {
        text:
          "📦 PRODUK DIGITAL",
        callback_data:
          "user:category:digital",
      },
    ]);
  }

  /*
   * Jika tidak ada produk aktif.
   */
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

  /*
   * Saat kembali ke menu menggunakan
   * message yang sudah ada.
   */
  if (messageId) {
    return editMessage(
      env,
      chatId,
      messageId,
      text,
      buttons
    );
  }

  /*
   * Saat /start dan welcome photo tersedia.
   */
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

export async function showProductCategory(
  env,
  chatId,
  messageId,
  type
) {
  const products =
    await getActiveProducts(env);

  const settings =
    await getShopSettings(env);

  const productType =
    type === "vip"
      ? "VIP"
      : "DIGITAL";

  const title =
    productType === "VIP"
      ? "🔐 PRODUK VIP"
      : "📦 PRODUK DIGITAL";

  const filteredProducts =
    products.filter(
      (product) =>
        product.type ===
        productType
    );

  const buttons =
    filteredProducts.map(
      (product) => [
        {
          text:
            `${
              productType === "VIP"
                ? "🟢"
                : "📦"
            } ${product.name}`,

          callback_data:
            `product:${product.id}`,
        },
      ]
    );

  /*
   * Jika kategori kosong.
   */
  if (
    filteredProducts.length === 0
  ) {
    buttons.push([
      {
        text:
          settings.btn_back_label,
        callback_data:
          "user:menu",
      },
    ]);

    return editMessage(
      env,
      chatId,
      messageId,
`${title}

Belum ada produk tersedia.`,
      buttons
    );
  }

  /*
   * Tombol kembali ke menu utama.
   */
  buttons.push([
    {
      text:
        settings.btn_back_label,
      callback_data:
        "user:menu",
    },
  ]);

  return editMessage(
    env,
    chatId,
    messageId,
`${title}

Silakan pilih produk:`,
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

${
  settings.cs_contact ||
  "Belum ada kontak CS yang diatur."
}`,
    [
      [
        {
          text:
            settings.btn_back_label,
          callback_data:
            "user:menu",
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
      getProduct(
        env,
        productId
      ),
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
            text:
              settings.btn_back_label,
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
      formatPriceDigits(
        product.price,
        settings
      )
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
          text:
            settings.btn_pay_label,
          callback_data:
            `order:create:${product.id}`,
        },
      ],
      [
        {
          text:
            settings.btn_back_label,
          callback_data:
            "user:menu",
        },
      ],
    ]
  );
}

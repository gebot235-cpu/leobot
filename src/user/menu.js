import {
  sendMessage,
  editMessage,
} from "../telegram.js";

import {
  getActiveProducts,
  getProduct,
} from "../products/products.js";


export async function showMainMenu(
  env,
  chatId,
  messageId = null
) {
  const products =
    await getActiveProducts(env);

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
    return editMessage(
      env,
      chatId,
      messageId,
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


export async function showProduct(
  env,
  chatId,
  messageId,
  productId
) {
  const product =
    await getProduct(
      env,
      productId
    );

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
            text: "◀️ KEMBALI",
            callback_data:
              "user:menu",
          },
        ],
      ]
    );
  }

  let text =
`📦 ${product.name}

`;

  if (product.description) {
    text +=
      `${product.description}\n\n`;
  }

  text +=
    `💰 Harga: Rp${Number(product.price).toLocaleString("id-ID")}`;

  if (product.type === "VIP") {
    text +=
      `\n⏳ Masa aktif: ${product.duration_days} hari`;
  }

  text +=
    `\n\nSilakan lanjutkan pembayaran.`;

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text: "💳 BAYAR",
          callback_data:
            `order:create:${product.id}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "user:menu",
        },
      ],
    ]
  );
}

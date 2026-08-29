import {
  sendMessage,
} from "../telegram.js";

import {
  getActiveProducts,
  getProduct,
} from "../products/products.js";


export async function showMainMenu(
  env,
  chatId
) {
  const products = await getActiveProducts(env);

  const text =
`🦁 LEOBOT

Selamat datang di toko kami! 👋

Silakan pilih produk:`;

  const buttons = products.map((product) => [
    {
      text:
        `${product.type === "VIP" ? "🟢" : "📦"} ${product.name}`,
      callback_data: `product:${product.id}`,
    },
  ]);

  if (buttons.length === 0) {
    return sendMessage(
      env,
      chatId,
`${text}

Saat ini belum ada produk yang tersedia.`
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
  productId
) {
  const product = await getProduct(
    env,
    productId
  );

  if (!product || !product.is_active) {
    return sendMessage(
      env,
      chatId,
      "❌ Produk tidak tersedia."
    );
  }

  let text =
`📦 ${product.name}

`;

  if (product.description) {
    text += `${product.description}\n\n`;
  }

  text += `💰 Harga: Rp${Number(product.price).toLocaleString("id-ID")}`;

  if (product.type === "VIP") {
    text += `\n⏳ Masa aktif: ${product.duration_days} hari`;
  }

  text += `\n\nSilakan lanjutkan pembayaran.`;

  // Untuk sementara belum membuat QRIS.
  // Tahap berikutnya fungsi ini akan membuat order
  // lalu langsung mengirim QRIS.

  return sendMessage(
    env,
    chatId,
    text
  );
}

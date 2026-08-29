import { editMessage } from "../telegram.js";
import { supabase } from "../supabase.js";

export async function showAdminProducts(
  env,
  chatId,
  messageId
) {
  const products = await getAllProducts(env);

  const buttons = [
    [
      {
        text: "➕ TAMBAH PRODUK",
        callback_data: "admin:product:add"
      }
    ],
    [
      {
        text: "📋 DAFTAR PRODUK",
        callback_data: "admin:product:list"
      }
    ],
    [
      {
        text: "◀️ KEMBALI",
        callback_data: "admin:menu"
      }
    ]
  ];

  return editMessage(
    env,
    chatId,
    messageId,

`📦 PRODUK

Kelola produk toko.

Total produk: ${products.length}`,

    buttons
  );
}


export async function showProductList(
  env,
  chatId,
  messageId
) {
  const products =
    await getAllProducts(env);

  const buttons = [];

  for (const product of products) {
    buttons.push([
      {
        text:
          `${product.is_active ? "🟢" : "🔴"} ${product.name}`,
        callback_data:
          `admin:product:view:${product.id}`
      }
    ]);
  }

  buttons.push([
    {
      text: "◀️ KEMBALI",
      callback_data: "admin:products"
    }
  ]);

  let text =
`📋 DAFTAR PRODUK

`;

  if (products.length === 0) {
    text += "Belum ada produk.";
  } else {
    text += "Pilih produk:";
  }

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    buttons
  );
}


async function getAllProducts(env) {
  return supabase(
    env,
    "products?order=id.asc"
  );
}

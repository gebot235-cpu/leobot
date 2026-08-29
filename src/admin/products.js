import { sendMessage } from "../telegram.js";
import { getActiveProducts } from "../products/products.js";

export async function showAdminProducts(env, chatId) {
  const products = await getAllProducts(env);

  const buttons = [];

  buttons.push([
    {
      text: "➕ TAMBAH PRODUK",
      callback_data: "admin:product:add"
    }
  ]);

  for (const product of products) {
    buttons.push([
      {
        text:
          `${product.is_active ? "🟢" : "🔴"} ${product.name}`,
        callback_data: `admin:product:${product.id}`
      }
    ]);
  }

  buttons.push([
    {
      text: "◀️ KEMBALI",
      callback_data: "admin:menu"
    }
  ]);

  let text = "📦 KELOLA PRODUK\n\n";

  if (products.length === 0) {
    text += "Belum ada produk.";
  } else {
    text += "Pilih produk untuk mengelola:";
  }

  await sendMessage(
    env,
    chatId,
    text,
    buttons
  );
}

async function getAllProducts(env) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/products?order=id.asc`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization:
          `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      await response.text()
    );
  }

  return response.json();
}

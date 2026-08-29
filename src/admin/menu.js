import { editMessage } from "../telegram.js";
import { supabase } from "../supabase.js";

export async function isAdmin(env, telegramId) {
  const admins = await supabase(
    env,
    `admins?telegram_id=eq.${telegramId}&is_active=eq.true&limit=1`
  );

  return admins.length > 0;
}

export async function showAdminMenu(
  env,
  chatId,
  messageId
) {
  return editMessage(
    env,
    chatId,
    messageId,

`👑 LEOBOT ADMIN

Kelola toko:`,

    [
      [
        {
          text: "📦 PRODUK",
          callback_data: "admin:products"
        }
      ],
      [
        {
          text: "💳 PEMBAYARAN",
          callback_data: "admin:payment"
        }
      ],
      [
        {
          text: "📢 CHANNEL VIP",
          callback_data: "admin:channel"
        }
      ],
      [
        {
          text: "⚙️ PENGATURAN",
          callback_data: "admin:settings"
        }
      ]
    ]
  );
}

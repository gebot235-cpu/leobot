export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("LeoBot is online ✅");
    }

    if (request.method === "POST" && url.pathname === "/telegram") {
      const update = await request.json();

      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || "";

        if (text === "/start") {
          await sendMessage(
            env.BOT_TOKEN,
            chatId,
            "🦁 Selamat datang di LeoBot!\n\n🏪 Toko digital & VIP\n\nSilakan pilih menu:",
            {
              inline_keyboard: [
                [
                  { text: "🛒 Beli VIP", callback_data: "buy_vip" }
                ],
                [
                  { text: "📦 Produk Digital", callback_data: "digital" }
                ],
                [
                  { text: "🛒 Pesanan Saya", callback_data: "orders" }
                ],
                [
                  { text: "👤 Akun Saya", callback_data: "account" }
                ]
              ]
            }
          );
        }
      }

      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function sendMessage(token, chatId, text, replyMarkup) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup
      })
    }
  );

  return response;
}

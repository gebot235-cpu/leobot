import {
  sendMessage,
  sendMediaByType,
  createSingleUseInviteLink,
} from "./telegram.js";

import {
  supabase,
} from "./supabase.js";

import {
  getMessage,
} from "./admin/messages.js";

export async function deliverProduct(
  env,
  order
) {
  const product =
    await getProduct(
      env,
      order.product_id
    );

  if (!product) {
    throw new Error(
      `Produk #${order.product_id} untuk order ${order.order_code} tidak ditemukan.`
    );
  }

  await sendTemplateMessage(
    env,
    order.telegram_id,
    "message_payment_success",
    {
      first_name:
        order.first_name || "",
      order_code:
        order.order_code || "",
    }
  );

  if (product.type === "DIGITAL") {
    return deliverDigitalProduct(
      env,
      order,
      product
    );
  }

  if (product.type === "VIP") {
    return deliverVipProduct(
      env,
      order,
      product
    );
  }

  throw new Error(
    `Jenis produk "${product.type}" belum didukung untuk pengiriman otomatis.`
  );
}

async function deliverDigitalProduct(
  env,
  order,
  product
) {
  if (!product.file_id) {
    throw new Error(
      `Produk digital "${product.name}" belum punya file_id.`
    );
  }

  await sendMediaByType(
    env,
    order.telegram_id,
    product.file_id,
    product.file_type
  );

  return sendTemplateMessage(
    env,
    order.telegram_id,
    "message_digital_sent",
    {
      first_name:
        order.first_name || "",
      product_name:
        product.name || "",
    }
  );
}

async function deliverVipProduct(
  env,
  order,
  product
) {
  const channels =
    await getProductChannels(
      env,
      product.id
    );

  if (!channels.length) {
    throw new Error(
      `Produk VIP "${product.name}" belum punya channel terhubung.`
    );
  }

  const links = [];

  for (const channel of channels) {
    const invite =
      await createSingleUseInviteLink(
        env,
        channel.channel_id,
        `order-${order.order_code}`
      );

    const inviteLink =
      invite?.invite_link || null;

    if (inviteLink) {
      links.push({
        name:
          channel.name ||
          "Channel VIP",
        url: inviteLink,
      });
    }

    await supabase(
      env,
      "vip_memberships",
      "POST",
      {
        telegram_id:
          Number(order.telegram_id),
        channel_id:
          Number(channel.channel_id),
        product_id:
          Number(product.id),
        order_id:
          Number(order.id),
        invite_link:
          inviteLink,
        joined_at:
          null,
        expires_at:
          null,
      }
    );
  }

  const linksText = links
    .map(
      (link) =>
        `• ${link.name}: ${link.url}`
    )
    .join("\n");

  const inlineKeyboard = links.map(
    (link) => [
      {
        text: "🚀 MASUK CHANNEL",
        url: link.url,
      },
    ]
  );

  const template =
    await getVipWaitingTemplate(
      env
    );

  const text =
    replaceTemplateVariables(
      template,
      {
        first_name:
          order.first_name || "",
        order_code:
          order.order_code || "",
        product_name:
          product.name || "",
      }
    ) +
    (linksText
      ? `\n\n🔗 Link akses (sekali pakai, berlaku 5 jam):\n${linksText}`
      : "");

  return sendMessage(
    env,
    order.telegram_id,
    text,
    inlineKeyboard
  );
}

async function getVipWaitingTemplate(
  env
) {
  const keys = [
    "message_vip_waiting",
    "vip_waiting",
    "waiting_vip",
  ];

  for (const key of keys) {
    const rows =
      await supabase(
        env,
        `settings?key=eq.${encodeURIComponent(
          key
        )}&limit=1`
      );

    const value =
      rows?.[0]?.value;

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return String(value);
    }
  }

  return `✅ Pembayaran berhasil!

📦 {product_name}
🧾 Order #{order_code}

Silakan masuk ke channel VIP menggunakan tombol di bawah.

⚠️ Masa aktif VIP baru dimulai setelah kamu berhasil masuk channel.

🔗 Link akses berlaku 5 jam dan hanya dapat digunakan sekali.`;
}

async function sendTemplateMessage(
  env,
  chatId,
  templateKey,
  variables
) {
  const template =
    await getMessage(
      env,
      templateKey
    );

  const text =
    replaceTemplateVariables(
      template,
      variables
    );

  return sendMessage(
    env,
    chatId,
    text
  );
}

function replaceTemplateVariables(
  template,
  values
) {
  let text =
    String(template || "");

  for (
    const [
      key,
      value,
    ] of Object.entries(
      values || {}
    )
  ) {
    text =
      text.replaceAll(
        `{${key}}`,
        String(value ?? "")
      );
  }

  return text;
}

async function getProduct(
  env,
  productId
) {
  const rows =
    await supabase(
      env,
      `products?id=eq.${Number(productId)}&limit=1`
    );

  return rows?.[0] || null;
}

async function getProductChannels(
  env,
  productId
) {
  const rows =
    (await supabase(
      env,
      `product_channels?product_id=eq.${productId}`
    )) || [];

  if (!rows.length) {
    return [];
  }

  const ids = rows
    .map(
      (row) =>
        Number(row.channel_id)
    )
    .filter(
      Number.isSafeInteger
    );

  if (!ids.length) {
    return [];
  }

  return (
    (await supabase(
      env,
      `vip_channels?id=in.(${ids.join(
        ","
      )})&is_active=eq.true`
    )) || []
  );
}

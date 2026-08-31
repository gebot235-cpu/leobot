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

/**
 * INI ADALAH FITUR YANG SEBELUMNYA HILANG TOTAL.
 *
 * Sebelum modul ini ada, `processPaymentSuccess` di payment.js
 * cuma mengubah status order menjadi PAID lalu berhenti — tidak
 * ada file digital yang dikirim, tidak ada invite link VIP yang
 * dibuat, dan template pesan "PEMBAYARAN BERHASIL" / "DIGITAL
 * TERKIRIM" / "VIP AKTIF" yang bisa diedit admin tidak pernah
 * benar-benar dipakai. Customer bayar tapi tidak menerima apa pun
 * secara otomatis.
 *
 * deliverProduct() dipanggil oleh payment.js tepat setelah webhook
 * BuatQris mengonfirmasi pembayaran sukses.
 */
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

  const durationDays =
    Number(product.duration_days) || 0;

  const expiresAt =
    new Date(
      Date.now() +
        durationDays * 24 * 60 * 60 * 1000
    );

  const links = [];

  for (const channel of channels) {
    const invite =
      await createSingleUseInviteLink(
        env,
        channel.channel_id,
        `order-${order.order_code}`
      );

    if (invite?.invite_link) {
      links.push({
        name:
          channel.name ||
          "Channel VIP",
        url: invite.invite_link,
      });
    }

    /*
     * Catat keanggotaan VIP supaya cron bisa mengirim reminder
     * sebelum expired dan auto-kick tepat waktu saat expired.
     * Perlu tabel `vip_memberships` — lihat migrations/README.
     */
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
        expires_at:
          expiresAt.toISOString(),
      }
    );
  }

  const linksText = links
    .map(
      (link) =>
        `• ${link.name}: ${link.url}`
    )
    .join("\n");

  const template =
    await getMessage(
      env,
      "message_vip_active"
    );

  const text =
    replaceTemplateVariables(
      template,
      {
        first_name:
          order.first_name || "",
        expires_at:
          expiresAt.toLocaleDateString(
            "id-ID",
            {
              day: "numeric",
              month: "long",
              year: "numeric",
            }
          ),
      }
    ) +
    (linksText
      ? `\n\n🔗 Link akses (sekali pakai):\n${linksText}`
      : "");

  return sendMessage(
    env,
    order.telegram_id,
    text
  );
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
  let text = String(template || "");

  for (const [key, value] of Object.entries(
    values || {}
  )) {
    text = text.replaceAll(
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
      `product_channels?product_id=eq.${Number(productId)}`
    )) || [];

  if (!rows.length) {
    return [];
  }

  const ids = rows
    .map((row) => Number(row.channel_id))
    .filter(Number.isSafeInteger);

  if (!ids.length) {
    return [];
  }

  return (
    (await supabase(
      env,
      `vip_channels?id=in.(${ids.join(",")})&is_active=eq.true`
    )) || []
  );
}

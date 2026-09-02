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

  if (product.type === "DIGITAL") {
    await sendTemplateMessage(
      env,
      order.telegram_id,
      "message_payment_success_digital",
      {
        first_name:
          order.first_name || "",
        product_name:
          product.name || "",
        order_code:
          order.order_code || "",
      }
    );

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
      `Produk VIP "${product.name}" belum memiliki channel aktif.`
    );
  }

  const links = [];
  const failedChannels = [];

  /*
   * Per-channel try/catch: kalau produk VIP terhubung ke beberapa
   * channel dan salah satunya gagal dibuatkan invite link (mis.
   * bot belum jadi admin di channel itu), channel lain yang
   * berhasil tetap dikirim ke customer — bukan gagal total tanpa
   * customer dapat apa pun sama sekali.
   */
  for (const channel of channels) {
    try {
      const invite =
        await createSingleUseInviteLink(
          env,
          channel.channel_id,
          `order-${order.order_code}`
        );

      if (!invite?.invite_link) {
        throw new Error(
          "Telegram tidak mengembalikan invite_link."
        );
      }

      links.push({
        name:
          channel.name ||
          "Channel VIP",
        url:
          invite.invite_link,
      });

      const existing =
        await supabase(
          env,
          `vip_memberships?order_id=eq.${Number(
            order.id
          )}&channel_id=eq.${Number(
            channel.channel_id
          )}&limit=1`
        );

      if (existing?.[0]) {
        await supabase(
          env,
          `vip_memberships?id=eq.${Number(
            existing[0].id
          )}`,
          "PATCH",
          {
            telegram_id:
              Number(order.telegram_id),
            product_id:
              Number(product.id),
            invite_link:
              invite.invite_link,
            joined_at:
              null,
            expires_at:
              null,
          }
        );
      } else {
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
              invite.invite_link,
            joined_at:
              null,
            expires_at:
              null,
          }
        );
      }
    } catch (error) {
      console.error(
        `Gagal buat invite link untuk channel ${channel.channel_id} (order ${order.order_code}):`,
        error
      );

      failedChannels.push(
        channel.name || channel.channel_id
      );
    }
  }

  if (!links.length) {
    /*
     * Semua channel gagal — lempar error supaya order ditandai
     * DELIVERY_FAILED dan admin sadar ada yang perlu dibenahi
     * (biasanya bot belum admin di channel terkait).
     */
    throw new Error(
      `Semua channel gagal dibuatkan invite link untuk order ${order.order_code}: ${failedChannels.join(", ")}`
    );
  }

  const linksText =
    links
      .map(
        (link) =>
          `• ${link.name}: ${link.url}`
      )
      .join("\n");

  const inlineKeyboard =
    links.map(
      (link) => [
        {
          text:
            "🚀 MASUK CHANNEL",
          url:
            link.url,
        },
      ]
    );

  const template =
    await getMessage(
      env,
      "message_payment_success"
    );

  let text =
    replaceTemplateVariables(
      template,
      {
        first_name:
          order.first_name || "",
        product_name:
          product.name || "",
        order_code:
          order.order_code || "",
      }
    ) +
    (
      linksText
        ? `\n\n🔗 Link akses:\n${linksText}`
        : ""
    );

  if (failedChannels.length) {
    /*
     * Customer tetap dapat link yang berhasil, tapi diberi tahu
     * ada channel yang belum bisa diproses supaya tidak bingung
     * kenapa jumlah link lebih sedikit dari ekspektasi.
     */
    text +=
      `\n\n⚠️ ${failedChannels.length} channel belum bisa diproses otomatis. Hubungi CS untuk akses tambahan.`;
  }

  await sendMessage(
    env,
    order.telegram_id,
    text,
    inlineKeyboard
  );

  if (failedChannels.length) {
    /*
     * Tetap lempar error setelah customer diberi tahu, supaya
     * order tercatat DELIVERY_FAILED (bukan DELIVERED penuh) dan
     * admin tahu ada channel yang perlu dibenahi manual.
     */
    throw new Error(
      `Sebagian channel gagal untuk order ${order.order_code}: ${failedChannels.join(", ")}`
    );
  }
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
        String(
          value ?? ""
        )
      );
  }

  return text;
}


async function getProduct(
  env,
  productId
) {
  const id =
    Number(productId);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  const rows =
    await supabase(
      env,
      `products?id=eq.${id}&limit=1`
    );

  return rows?.[0] || null;
}


async function getProductChannels(
  env,
  productId
) {
  const rows =
    (
      await supabase(
        env,
        `product_channels?product_id=eq.${Number(
          productId
        )}`
      )
    ) || [];

  if (!rows.length) {
    return [];
  }

  const ids =
    rows
      .map(
        (row) =>
          Number(
            row.channel_id
          )
      )
      .filter(
        Number.isSafeInteger
      );

  if (!ids.length) {
    return [];
  }

  return (
    (
      await supabase(
        env,
        `vip_channels?id=in.(${ids.join(
          ","
        )})&is_active=eq.true`
      )
    ) || []
  );
}

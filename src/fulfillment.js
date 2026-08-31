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

const links = [];

  for (const channel of channels) {
    const invite =
      await createSingleUseInviteLink(
        env,
        channel.channel_id,
        `order-${order.order_code}`
      );

    if (!invite?.invite_link) {
      throw new Error(
        `Gagal membuat invite link untuk channel ${channel.channel_id}.`
      );
    }

    links.push({
      name:
        channel.name ||
        "Channel VIP",
      url: invite.invite_link,
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
  }

  const linksText = links
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

  const text =
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
    (linksText
      ? `\n\n🔗 Link akses:\n${linksText}`
      : "");

  return sendMessage(
    env,
    order.telegram_id,
    text,
    inlineKeyboard
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
    (await supabase(
      env,
      `product_channels?product_id=eq.${Number(
        productId
      )}`
    )) || [];

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
    (await supabase(
      env,
      `vip_channels?id=in.(${ids.join(
        ","
      )})&is_active=eq.true`
    )) || []
  );
}

import {
  editMessage,
  deleteMessage,
} from "../telegram.js";

import {
  supabase,
} from "../supabase.js";

export async function showDigitalProduct(
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
    product.type !== "DIGITAL"
  ) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Produk digital tidak ditemukan.",
      [
        [
          {
            text: "◀️ PRODUK",
            callback_data:
              "admin:product:list",
          },
        ],
      ]
    );
  }

  await deleteState(
    env,
    chatId
  );

  return editMessage(
    env,
    chatId,
    messageId,
`📦 ${product.name}

💰 Rp${Number(
      product.price || 0
    ).toLocaleString("id-ID")}

🏷️ DIGITAL
🟢 Status: ${
      product.is_active
        ? "Aktif"
        : "Nonaktif"
    }

${product.description || "Tanpa deskripsi"}

📎 File: ${
      product.file_id
        ? "Tersedia"
        : "Belum ada"
    }`,
    [
      [
        {
          text: "✏️ EDIT",
          callback_data:
            `admin:digital:edit:${product.id}`,
        },
      ],
      [
        {
          text: product.is_active
            ? "🔴 NONAKTIFKAN"
            : "🟢 AKTIFKAN",
          callback_data:
            `admin:product:toggle:${product.id}`,
        },
      ],
      [
        {
          text: "🗑️ HAPUS",
          callback_data:
            `admin:digital:delete:${product.id}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:product:list",
        },
      ],
    ]
  );
}

export async function showDigitalEdit(
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
    product.type !== "DIGITAL"
  ) {
    return;
  }

  await deleteState(
    env,
    chatId
  );

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT PRODUK DIGITAL

📦 ${product.name}

Pilih data yang ingin diubah:`,
    [
      [
        {
          text: "📝 NAMA",
          callback_data:
            `admin:digital:field:name:${product.id}`,
        },
      ],
      [
        {
          text: "📄 DESKRIPSI",
          callback_data:
            `admin:digital:field:description:${product.id}`,
        },
      ],
      [
        {
          text: "💰 HARGA",
          callback_data:
            `admin:digital:field:price:${product.id}`,
        },
      ],
      [
        {
          text: "📎 FILE",
          callback_data:
            `admin:digital:file:${product.id}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            `admin:digital:view:${product.id}`,
        },
      ],
    ]
  );
}

export async function startDigitalFieldEdit(
  env,
  chatId,
  messageId,
  productId,
  field
) {
  const product =
    await getProduct(
      env,
      productId
    );

  if (
    !product ||
    product.type !== "DIGITAL"
  ) {
    return;
  }

  const labels = {
    name: "NAMA",
    description: "DESKRIPSI",
    price: "HARGA",
  };

  const label =
    labels[field];

  if (!label) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type:
        "EDIT_DIGITAL",
      product_id:
        Number(productId),
      field,
      message_id:
        messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT ${label}

Produk:
${product.name}

Kirim nilai baru:`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:digital:cancel:${product.id}`,
        },
      ],
    ]
  );
}

export async function handleDigitalFieldInput(
  env,
  message,
  state
) {
  const value =
    message.text?.trim();

  if (!value) {
    return true;
  }

  const fields = [
    "name",
    "description",
    "price",
  ];

  if (
    !fields.includes(
      state.field
    )
  ) {
    return true;
  }

  let finalValue =
    value;

  if (
    state.field === "price"
  ) {
    if (!/^\d+$/.test(value)) {
      await editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Harga tidak valid.

Kirim angka saja.`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data:
                `admin:digital:cancel:${state.product_id}`,
            },
          ],
        ]
      );

      return true;
    }

    const price =
      Number(value);

    if (
      !Number.isSafeInteger(
        price
      ) ||
      price <= 0
    ) {
      await editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Harga tidak valid.

Kirim angka yang lebih dari 0.`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data:
                `admin:digital:cancel:${state.product_id}`,
            },
          ],
        ]
      );

      return true;
    }

    finalValue =
      price;
  }

  await supabase(
    env,
    `products?id=eq.${Number(
      state.product_id
    )}`,
    "PATCH",
    {
      [state.field]:
        finalValue,
      updated_at:
        new Date().toISOString(),
    }
  );

  await deleteState(
    env,
    message.chat.id
  );

  try {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );
  } catch {}

  return showDigitalEdit(
    env,
    message.chat.id,
    state.message_id,
    state.product_id
  );
}

export async function startDigitalFileEdit(
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
    product.type !== "DIGITAL"
  ) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type:
        "EDIT_DIGITAL_FILE",
      product_id:
        Number(productId),
      message_id:
        messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`📎 GANTI FILE

Produk:
${product.name}

Kirim file digital sekarang.`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:digital:cancel:${product.id}`,
        },
      ],
    ]
  );
}

export async function handleDigitalFileInput(
  env,
  message,
  state
) {
  const fileId =
    message.document?.file_id ||
    message.photo?.at(-1)?.file_id;

  if (!fileId) {
    return true;
  }

  await supabase(
    env,
    `products?id=eq.${Number(
      state.product_id
    )}`,
    "PATCH",
    {
      file_id:
        fileId,
      updated_at:
        new Date().toISOString(),
    }
  );

  await deleteState(
    env,
    message.chat.id
  );

  try {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );
  } catch {}

  return showDigitalEdit(
    env,
    message.chat.id,
    state.message_id,
    state.product_id
  );
}

export async function cancelDigitalProcess(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(
    env,
    chatId
  );

  return showDigitalEdit(
    env,
    chatId,
    messageId,
    productId
  );
}

export async function confirmDeleteDigital(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(
    env,
    chatId
  );

  const product =
    await getProduct(
      env,
      productId
    );

  if (
    !product ||
    product.type !== "DIGITAL"
  ) {
    return;
  }

  return editMessage(
    env,
    chatId,
    messageId,
`🗑️ HAPUS PRODUK DIGITAL

${product.name}

Produk akan dihapus permanen.`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:digital:view:${product.id}`,
        },
      ],
      [
        {
          text: "🗑️ HAPUS",
          callback_data:
            `admin:digital:delete-confirm:${product.id}`,
        },
      ],
    ]
  );
}

export async function deleteDigitalProduct(
  env,
  chatId,
  messageId,
  productId
) {
  await deleteState(
    env,
    chatId
  );

  await supabase(
    env,
    `products?id=eq.${Number(
      productId
    )}`,
    "DELETE"
  );

  return editMessage(
    env,
    chatId,
    messageId,
    "✅ PRODUK DIGITAL DIHAPUS.",
    [
      [
        {
          text: "📦 PRODUK",
          callback_data:
            "admin:products",
        },
      ],
      [
        {
          text: "◀️ ADMIN",
          callback_data:
            "admin:menu",
        },
      ],
    ]
  );
}

async function getProduct(
  env,
  productId
) {
  const rows =
    await supabase(
      env,
      `products?id=eq.${Number(
        productId
      )}&limit=1`
    );

  return rows?.[0] || null;
}

async function saveState(
  env,
  telegramId,
  state
) {
  return supabase(
    env,
    "settings",
    "POST",
    {
      key:
        `admin_state_${telegramId}`,
      value:
        JSON.stringify(state),
      updated_at:
        new Date().toISOString(),
    },
    {
      Prefer:
        "resolution=merge-duplicates",
    }
  );
}

async function deleteState(
  env,
  telegramId
) {
  return supabase(
    env,
    `settings?key=eq.admin_state_${telegramId}`,
    "DELETE"
  );
}

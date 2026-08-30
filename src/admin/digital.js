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
    await getProduct(env, productId);

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

  await deleteState(env, chatId);

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
    await getProduct(env, productId);

  if (
    !product ||
    product.type !== "DIGITAL"
  ) {
    return;
  }

  await deleteState(env, chatId);

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
    await getProduct(env, productId);

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

  const label = labels[field];

  if (!label) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type: "EDIT_DIGITAL",
      product_id: Number(productId),
      field,
      message_id: messageId,
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

  if (!fields.includes(state.field)) {
    return true;
  }

  let finalValue = value;

  if (state.field === "price") {
    if (!/^\d+$/.test(value)) {
      return editMessage(
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
    }

    const price = Number(value);

    if (
      !Number.isSafeInteger(price) ||
      price <= 0
    ) {
      return true;
    }

    finalValue = price;
  }

  await supabase(
    env,
    `products?id=eq.${Number(
      state.product_id
    )}`,
    "PATCH",
    {
      [state.field]: finalValue,
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
    await getProduct(env, productId);

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
      type: "EDIT_DIGITAL_FILE",
      product_id: Number(productId),
      message_id: messageId,
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

  if (
    state.type ===
    "ADD_DIGITAL_FILE"
  ) {
    return handleAddDigitalFile(
      env,
      message,
      state,
      fileId
    );
  }

  await supabase(
    env,
    `products?id=eq.${Number(
      state.product_id
    )}`,
    "PATCH",
    {
      file_id: fileId,
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


async function handleAddDigitalFile(
  env,
  message,
  state,
  fileId
) {
  const nextState = {
    ...state,
    step: "CONFIRM",
    file_id: fileId,
  };

  await saveState(
    env,
    message.chat.id,
    nextState
  );

  try {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );
  } catch {}

  return showAddDigitalConfirmation(
    env,
    message.chat.id,
    state.message_id,
    nextState
  );
}


export async function startAddDigitalFile(
  env,
  chatId,
  messageId
) {
  const state =
    await getState(env, chatId);

  if (!state) {
    return;
  }

  const nextState = {
    ...state,
    type: "ADD_DIGITAL",
    step: "UPLOAD_FILE",
    message_id: messageId,
  };

  await saveState(
    env,
    chatId,
    nextState
  );

  return editMessage(
    env,
    chatId,
    messageId,
`➕ TAMBAH DIGITAL

📦 ${state.name}

💰 Rp${Number(
      state.price || 0
    ).toLocaleString("id-ID")}

📎 Upload file digital sekarang.`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:product:cancel",
        },
      ],
    ]
  );
}


async function showAddDigitalConfirmation(
  env,
  chatId,
  messageId,
  state
) {
  return editMessage(
    env,
    chatId,
    messageId,
`➕ KONFIRMASI PRODUK DIGITAL

📦 ${state.name}

💰 Rp${Number(
      state.price || 0
    ).toLocaleString("id-ID")}

📎 File: Tersedia

${
  state.description
    ? `📝 ${state.description}`
    : "📝 Tanpa deskripsi"
}`,
    [
      [
        {
          text: "✅ SIMPAN",
          callback_data:
            "admin:digital:add:save",
        },
      ],
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:product:cancel",
        },
      ],
    ]
  );
}


export async function saveNewDigitalProduct(
  env,
  chatId,
  messageId
) {
  const state =
    await getState(env, chatId);

  if (!state) {
    return;
  }

  if (
    !state.name ||
    !state.price ||
    !state.file_id
  ) {
    return;
  }

  const rows =
    await supabase(
      env,
      "products",
      "POST",
      {
        name: state.name,
        description:
          state.description || null,
        price: Number(state.price),
        type: "DIGITAL",
        duration_days: null,
        file_id: state.file_id,
        is_active: true,
      },
      {
        Prefer:
          "return=representation",
      }
    );

  const product = rows?.[0];

  if (!product) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Gagal menyimpan produk digital.",
      [
        [
          {
            text: "◀️ PRODUK",
            callback_data:
              "admin:products",
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
`✅ PRODUK DIGITAL TERSIMPAN

📦 ${product.name}

💰 Rp${Number(
      product.price || 0
    ).toLocaleString("id-ID")}

📎 File tersimpan.`,
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


export async function cancelDigitalProcess(
  env,
  chatId,
  messageId,
  productId = null
) {
  await deleteState(
    env,
    chatId
  );

  if (productId) {
    return showDigitalEdit(
      env,
      chatId,
      messageId,
      productId
    );
  }

  return editMessage(
    env,
    chatId,
    messageId,
    "📦 PRODUK",
    [
      [
        {
          text: "➕ TAMBAH PRODUK",
          callback_data:
            "admin:product:add",
        },
      ],
      [
        {
          text: "📋 DAFTAR PRODUK",
          callback_data:
            "admin:product:list",
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            "admin:menu",
        },
      ],
    ]
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


async function getState(
  env,
  telegramId
) {
  const rows =
    await supabase(
      env,
      `settings?key=eq.admin_state_${telegramId}&limit=1`
    );

  if (!rows?.length) {
    return null;
  }

  try {
    return JSON.parse(
      rows[0].value
    );
  } catch {
    return null;
  }
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

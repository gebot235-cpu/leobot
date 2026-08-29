import {
  editMessage,
  deleteMessage,
} from "../telegram.js";

import {
  supabase,
} from "../supabase.js";


export async function showAdminProducts(
  env,
  chatId,
  messageId
) {
  const products =
    await getAllProducts(env);

  return editMessage(
    env,
    chatId,
    messageId,
`📦 PRODUK

Total produk: ${products.length}`,

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


export async function showProductList(
  env,
  chatId,
  messageId
) {
  const products =
    await getAllProducts(env);

  const buttons =
    products.map((product) => [
      {
        text:
          `${product.is_active ? "🟢" : "🔴"} ${product.name}`,
        callback_data:
          `admin:product:view:${product.id}`,
      },
    ]);

  buttons.push([
    {
      text: "➕ TAMBAH",
      callback_data:
        "admin:product:add",
    },
  ]);

  buttons.push([
    {
      text: "◀️ KEMBALI",
      callback_data:
        "admin:products",
    },
  ]);

  const text =
    products.length === 0
      ? "📋 DAFTAR PRODUK\n\nBelum ada produk."
      : "📋 DAFTAR PRODUK\n\nPilih produk:";

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    buttons
  );
}


export async function showProductDetail(
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

  if (!product) {
    return editMessage(
      env,
      chatId,
      messageId,
      "❌ Produk tidak ditemukan.",
      [
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

  let text =
`📦 ${product.name}

💰 Rp${Number(product.price).toLocaleString("id-ID")}

🏷️ ${product.type}
🟢 Status: ${
    product.is_active
      ? "Aktif"
      : "Nonaktif"
  }`;

  if (product.description) {
    text +=
      `\n\n📝 ${product.description}`;
  }

  if (product.type === "VIP") {
    text +=
      `\n⏳ ${product.duration_days} hari`;

    if (product.channel_id) {
      text +=
        `\n📢 Channel: ${product.channel_id}`;
    }
  }

  if (product.type === "DIGITAL") {
    text +=
      `\n📎 File: ${
        product.file_id
          ? "Tersedia"
          : "Belum ada"
      }`;
  }

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text: "✏️ EDIT",
          callback_data:
            `admin:product:edit:${product.id}`,
        },
      ],
      [
        {
          text:
            product.is_active
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
            `admin:product:delete:${product.id}`,
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


export async function showProductEdit(
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

  if (!product) {
    return;
  }

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT PRODUK

📦 ${product.name}

Pilih data yang ingin diubah:`,

    [
      [
        {
          text: "📝 NAMA",
          callback_data:
            `admin:product:field:name:${product.id}`,
        },
      ],
      [
        {
          text: "📄 DESKRIPSI",
          callback_data:
            `admin:product:field:description:${product.id}`,
        },
      ],
      [
        {
          text: "💰 HARGA",
          callback_data:
            `admin:product:field:price:${product.id}`,
        },
      ],
      [
        {
          text: "⏳ DURASI",
          callback_data:
            `admin:product:field:duration_days:${product.id}`,
        },
      ],
      [
        {
          text: "◀️ KEMBALI",
          callback_data:
            `admin:product:view:${product.id}`,
        },
      ],
    ]
  );
}


export async function startProductFieldEdit(
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

  if (!product) {
    return;
  }

  const labels = {
    name: "NAMA",
    description: "DESKRIPSI",
    price: "HARGA",
    duration_days: "DURASI",
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
      type: "EDIT_PRODUCT",
      product_id: productId,
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
            `admin:product:edit:${product.id}`,
        },
      ],
    ]
  );
}


export async function handleProductInput(
  env,
  message,
  state
) {
  const value =
    message.text?.trim();

  if (!value) {
    return true;
  }

  const allowedFields = [
    "name",
    "description",
    "price",
    "duration_days",
  ];

  if (
    !allowedFields.includes(
      state.field
    )
  ) {
    return true;
  }

  let finalValue = value;

  if (
    state.field === "price" ||
    state.field === "duration_days"
  ) {
    const number =
      Number(
        value.replace(
          /\D/g,
          ""
        )
      );

    if (!Number.isFinite(number)) {
      return true;
    }

    finalValue = number;
  }

  await updateProduct(
    env,
    state.product_id,
    {
      [state.field]:
        finalValue,
      updated_at:
        new Date().toISOString(),
    }
  );

  await deleteState(
    env,
    message.from.id
  );

  await deleteMessage(
    env,
    message.chat.id,
    message.message_id
  );

  await showProductEdit(
    env,
    message.chat.id,
    state.message_id,
    state.product_id
  );

  return true;
}


export async function toggleProduct(
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

  if (!product) {
    return;
  }

  await updateProduct(
    env,
    productId,
    {
      is_active:
        !product.is_active,
      updated_at:
        new Date().toISOString(),
    }
  );

  return showProductDetail(
    env,
    chatId,
    messageId,
    productId
  );
}


export async function confirmDeleteProduct(
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

  if (!product) {
    return;
  }

  return editMessage(
    env,
    chatId,
    messageId,
`🗑️ HAPUS PRODUK

${product.name}

Produk akan dihapus permanen.`,

    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            `admin:product:view:${product.id}`,
        },
      ],
      [
        {
          text: "🗑️ HAPUS",
          callback_data:
            `admin:product:delete-confirm:${product.id}`,
        },
      ],
    ]
  );
}


export async function deleteProduct(
  env,
  chatId,
  messageId,
  productId
) {
  await supabase(
    env,
    `products?id=eq.${productId}`,
    "DELETE"
  );

  return showProductList(
    env,
    chatId,
    messageId
  );
}


export async function getProduct(
  env,
  productId
) {
  const rows =
    await supabase(
      env,
      `products?id=eq.${productId}&limit=1`
    );

  return rows[0] || null;
}


async function getAllProducts(
  env
) {
  return supabase(
    env,
    "products?order=id.asc"
  );
}


async function updateProduct(
  env,
  productId,
  data
) {
  return supabase(
    env,
    `products?id=eq.${productId}`,
    "PATCH",
    data
  );
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

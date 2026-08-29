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

  const buttons = [
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
  ];

  if (product.type === "VIP") {
    buttons.push([
      {
        text: "⏳ DURASI",
        callback_data:
          `admin:product:field:duration_days:${product.id}`,
      },
    ]);
  }

  buttons.push([
    {
      text: "◀️ KEMBALI",
      callback_data:
        `admin:product:view:${product.id}`,
    },
  ]);

  return editMessage(
    env,
    chatId,
    messageId,
`✏️ EDIT PRODUK

📦 ${product.name}

Pilih data yang ingin diubah:`,

    buttons
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

  const fields = [
    "name",
    "description",
    "price",
    "duration_days",
  ];

  if (!fields.includes(state.field)) {
    return true;
  }

  let finalValue = value;

  if (
    state.field === "price" ||
    state.field === "duration_days"
  ) {
    const number =
      Number(
        value.replace(/\D/g, "")
      );

    if (!Number.isFinite(number) || number <= 0) {
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


export async function startAddProduct(
  env,
  chatId,
  messageId
) {
  await saveState(
    env,
    chatId,
    {
      type: "ADD_PRODUCT",
      step: "TYPE",
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`➕ TAMBAH PRODUK

Pilih jenis produk:`,

    [
      [
        {
          text: "🟢 VIP",
          callback_data:
            "admin:product:add:type:VIP",
        },
      ],
      [
        {
          text: "📦 DIGITAL",
          callback_data:
            "admin:product:add:type:DIGITAL",
        },
      ],
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:products",
        },
      ],
    ]
  );
}


export async function selectAddProductType(
  env,
  chatId,
  messageId,
  type
) {
  if (
    type !== "VIP" &&
    type !== "DIGITAL"
  ) {
    return;
  }

  await saveState(
    env,
    chatId,
    {
      type: "ADD_PRODUCT",
      step: "NAME",
      product_type: type,
      message_id: messageId,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`➕ TAMBAH ${type}

Langkah 1/4

Kirim nama produk:`,

    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:products",
        },
      ],
    ]
  );
}


export async function handleAddProductInput(
  env,
  message,
  state
) {
  const value =
    message.text?.trim();

  if (!value) {
    return true;
  }

  if (state.step === "NAME") {
    await updateState(
      env,
      message.from.id,
      {
        ...state,
        step: "DESCRIPTION",
        name: value,
      }
    );

    await deleteInput(
      env,
      message
    );

    return editMessage(
      env,
      message.chat.id,
      state.message_id,
`➕ TAMBAH ${state.product_type}

Langkah 2/4

Nama:
${value}

Kirim deskripsi produk:`,

      [
        [
          {
            text: "⏭️ LEWATI",
            callback_data:
              "admin:product:add:skip:description",
          },
        ],
        [
          {
            text: "❌ BATAL",
            callback_data:
              "admin:products",
          },
        ],
      ]
    );
  }

  if (state.step === "DESCRIPTION") {
    await updateState(
      env,
      message.from.id,
      {
        ...state,
        step: "PRICE",
        description: value,
      }
    );

    await deleteInput(
      env,
      message
    );

    return editMessage(
      env,
      message.chat.id,
      state.message_id,
`➕ TAMBAH ${state.product_type}

Langkah 3/4

Kirim harga produk:

Contoh:
50000`,

      [
        [
          {
            text: "❌ BATAL",
            callback_data:
              "admin:products",
          },
        ],
      ]
    );
  }

  if (state.step === "PRICE") {
    const price =
      Number(
        value.replace(/\D/g, "")
      );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Harga tidak valid.

Kirim harga dalam angka.

Contoh:
50000`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data:
                "admin:products",
            },
          ],
        ]
      );
    }

    await updateState(
      env,
      message.from.id,
      {
        ...state,
        step:
          state.product_type === "VIP"
            ? "DURATION"
            : "CONFIRM",
        price,
      }
    );

    await deleteInput(
      env,
      message
    );

    if (
      state.product_type === "VIP"
    ) {
      return editMessage(
        env,
        message.chat.id,
        state.message_id,
`➕ TAMBAH VIP

Langkah 4/4

Kirim masa aktif dalam hari.

Contoh:
30`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data:
                "admin:products",
            },
          ],
        ]
      );
    }

    return showAddConfirmation(
      env,
      message.chat.id,
      state.message_id,
      {
        ...state,
        price,
      }
    );
  }

  if (state.step === "DURATION") {
    const duration =
      Number(
        value.replace(/\D/g, "")
      );

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return editMessage(
        env,
        message.chat.id,
        state.message_id,
`❌ Durasi tidak valid.

Kirim jumlah hari.

Contoh:
30`,
        [
          [
            {
              text: "❌ BATAL",
              callback_data:
                "admin:products",
            },
          ],
        ]
      );
    }

    await updateState(
      env,
      message.from.id,
      {
        ...state,
        step: "CONFIRM",
        duration_days:
          duration,
      }
    );

    await deleteInput(
      env,
      message
    );

    return showAddConfirmation(
      env,
      message.chat.id,
      state.message_id,
      {
        ...state,
        duration_days:
          duration,
      }
    );
  }

  return true;
}


export async function skipDescription(
  env,
  chatId,
  messageId
) {
  const state =
    await getState(
      env,
      chatId
    );

  if (!state) {
    return;
  }

  await updateState(
    env,
    chatId,
    {
      ...state,
      step: "PRICE",
      description: null,
    }
  );

  return editMessage(
    env,
    chatId,
    messageId,
`➕ TAMBAH ${state.product_type}

Langkah 3/4

Kirim harga produk:

Contoh:
50000`,
    [
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:products",
        },
      ],
    ]
  );
}


async function showAddConfirmation(
  env,
  chatId,
  messageId,
  state
) {
  let text =
`➕ KONFIRMASI PRODUK

📦 ${state.name}

🏷️ ${state.product_type}

💰 Rp${Number(state.price).toLocaleString("id-ID")}`;

  if (
    state.product_type === "VIP"
  ) {
    text +=
      `\n⏳ ${state.duration_days} hari`;
  }

  if (state.description) {
    text +=
      `\n\n📝 ${state.description}`;
  }

  return editMessage(
    env,
    chatId,
    messageId,
    text,
    [
      [
        {
          text: "✅ SIMPAN",
          callback_data:
            "admin:product:add:save",
        },
      ],
      [
        {
          text: "❌ BATAL",
          callback_data:
            "admin:products",
        },
      ],
    ]
  );
}


export async function saveNewProduct(
  env,
  chatId,
  messageId
) {
  const state =
    await getState(
      env,
      chatId
    );

  if (!state) {
    return;
  }

  if (
    !state.name ||
    !state.price ||
    !state.product_type
  ) {
    return;
  }

  if (
    state.product_type === "VIP" &&
    !state.duration_days
  ) {
    return;
  }

  await supabase(
    env,
    "products",
    "POST",
    {
      name: state.name,
      description:
        state.description || null,
      price: state.price,
      type: state.product_type,
      duration_days:
        state.product_type === "VIP"
          ? state.duration_days
          : null,
      is_active: true,
    }
  );

  await deleteState(
    env,
    chatId
  );

  return editMessage(
    env,
    chatId,
    messageId,
`✅ PRODUK TERSIMPAN

${state.name}

Produk berhasil ditambahkan.`,

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


async function getProduct(
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


async function getState(
  env,
  telegramId
) {
  const rows =
    await supabase(
      env,
      `settings?key=eq.admin_state_${telegramId}&limit=1`
    );

  if (!rows.length) {
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


async function updateState(
  env,
  telegramId,
  state
) {
  return saveState(
    env,
    telegramId,
    state
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


async function deleteInput(
  env,
  message
) {
  if (message.message_id) {
    await deleteMessage(
      env,
      message.chat.id,
      message.message_id
    );
  }
}

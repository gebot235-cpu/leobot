import {
sendMessage,
kickChatMember,
deleteMessage,
} from "./telegram.js";

import {
supabase,
} from "./supabase.js";

import {
getMessage,
} from "./admin/messages.js";

import {
checkPendingPayments,
} from "./payment.js";

export async function runCronTasks(env) {
const results = {
pendingPayments: 0,
expiredOrders: 0,
reminders: 0,
kicked: 0,
errors: [],
};

try {
const result =
await checkPendingPayments(env);

results.pendingPayments =
  Number.isFinite(result)
    ? result
    : 0;

} catch (error) {
console.error(
"Cron: gagal cek pending payments",
error
);

results.errors.push(
  String(error)
);

}

try {
results.expiredOrders =
await expirePendingOrders(env);
} catch (error) {
console.error(
"Cron: gagal expire pending orders",
error
);

results.errors.push(
  String(error)
);

}

try {
results.reminders =
await sendVipReminders(env);
} catch (error) {
console.error(
"Cron: gagal kirim reminder VIP",
error
);

results.errors.push(
  String(error)
);

}

try {
results.kicked =
await kickExpiredVipMembers(env);
} catch (error) {
console.error(
"Cron: gagal auto-kick VIP expired",
error
);

results.errors.push(
  String(error)
);

}

return results;
}

async function expirePendingOrders(env) {
const nowIso =
new Date().toISOString();

const rows =
(await supabase(
env,
"orders?status=eq.PENDING&qr_expires_at=lt.${encodeURIComponent( nowIso )}"
)) || [];

let expired = 0;

for (const order of rows) {
try {
if (
order.payment_message_id &&
order.telegram_id
) {
try {
await deleteMessage(
env,
order.telegram_id,
Number(
order.payment_message_id
)
);
} catch (error) {
console.error(
"Gagal menghapus QRIS order #${order.id}:",
error
);
}
}

  await supabase(
    env,
    `orders?id=eq.${Number(
      order.id
    )}&status=eq.PENDING`,
    "PATCH",
    {
      status:
        "EXPIRED",
    }
  );

  expired += 1;
} catch (error) {
  console.error(
    `Gagal expire order #${order.id}:`,
    error
  );
}

}

return expired;
}

const REMINDER_WINDOW_HOURS = 24;

async function sendVipReminders(env) {
const now =
new Date();

const windowEnd =
new Date(
now.getTime() +
REMINDER_WINDOW_HOURS *
60 *
60 *
1000
);

const rows =
(await supabase(
env,
"vip_memberships?kicked_at=is.null&reminded_at=is.null" +
"&expires_at=gte.${encodeURIComponent( now.toISOString() )}" +
"&expires_at=lte.${encodeURIComponent( windowEnd.toISOString() )}"
)) || [];

let sent = 0;

for (const membership of rows) {
try {
const text =
"⏰ PENGINGAT\n\n" +
"Masa aktif VIP kamu akan berakhir " +
"dalam waktu kurang dari 24 jam.\n\n" +
"Perpanjang sekarang supaya tidak terputus.";

  await sendMessage(
    env,
    membership.telegram_id,
    text
  );

  await supabase(
    env,
    `vip_memberships?id=eq.${Number(
      membership.id
    )}`,
    "PATCH",
    {
      reminded_at:
        new Date().toISOString(),
    }
  );

  sent += 1;
} catch (error) {
  console.error(
    `Gagal kirim reminder VIP untuk membership #${membership.id}:`,
    error
  );
}

}

return sent;
}

async function kickExpiredVipMembers(env) {
const nowIso =
new Date().toISOString();

const rows =
(await supabase(
env,
"vip_memberships?kicked_at=is.null&expires_at=lt.${encodeURIComponent( nowIso )}"
)) || [];

let kicked = 0;

for (const membership of rows) {
try {
await kickChatMember(
env,
membership.channel_id,
membership.telegram_id
);

  await supabase(
    env,
    `vip_memberships?id=eq.${Number(
      membership.id
    )}`,
    "PATCH",
    {
      kicked_at:
        new Date().toISOString(),
    }
  );

  const template =
    await getMessage(
      env,
      "message_vip_expired"
    );

  await sendMessage(
    env,
    membership.telegram_id,
    template
  );

  kicked += 1;
} catch (error) {
  console.error(
    `Gagal kick member VIP #${membership.id}:`,
    error
  );
}

}

return kicked;
}

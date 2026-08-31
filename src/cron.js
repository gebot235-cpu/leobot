import {
  sendMessage,
  kickChatMember,
} from "./telegram.js";

import {
  supabase,
} from "./supabase.js";

import {
  getMessage,
} from "./admin/messages.js";

/**
 * SEBELUMNYA TIDAK ADA SAMA SEKALI: tidak ada `scheduled` export
 * di index.js, tidak ada `[triggers] crons` di wrangler.toml.
 * Akibatnya order yang QR-nya kedaluwarsa nyangkut selamanya di
 * status PENDING, dan member VIP yang masa aktifnya habis tidak
 * pernah otomatis dikeluarkan dari channel.
 *
 * Dipanggil dari export `scheduled` di index.js.
 */
export async function runCronTasks(env) {
  const results = {
    expiredOrders: 0,
    reminders: 0,
    kicked: 0,
    errors: [],
  };

  try {
    results.expiredOrders =
      await expirePendingOrders(env);
  } catch (error) {
    console.error(
      "Cron: gagal expire pending orders",
      error
    );
    results.errors.push(String(error));
  }

  try {
    results.reminders =
      await sendVipReminders(env);
  } catch (error) {
    console.error(
      "Cron: gagal kirim reminder VIP",
      error
    );
    results.errors.push(String(error));
  }

  try {
    results.kicked =
      await kickExpiredVipMembers(env);
  } catch (error) {
    console.error(
      "Cron: gagal auto-kick VIP expired",
      error
    );
    results.errors.push(String(error));
  }

  return results;
}

/**
 * Order yang QR-nya sudah lewat waktu tapi belum dibayar (webhook
 * tidak pernah datang) akan diubah statusnya jadi EXPIRED supaya
 * tidak menumpuk selamanya sebagai PENDING.
 */
async function expirePendingOrders(env) {
  const nowIso = new Date().toISOString();

  const rows =
    await supabase(
      env,
      `orders?status=eq.PENDING&qr_expires_at=lt.${encodeURIComponent(nowIso)}`,
      "PATCH",
      {
        status: "EXPIRED",
      },
      {
        Prefer: "return=representation",
      }
    );

  return rows?.length || 0;
}

const REMINDER_WINDOW_HOURS = 24;

/**
 * Kirim reminder ke member VIP yang masa aktifnya akan habis dalam
 * REMINDER_WINDOW_HOURS jam ke depan, supaya sempat perpanjang.
 * Hanya dikirim sekali per membership (kolom reminded_at).
 */
async function sendVipReminders(env) {
  const now = new Date();

  const windowEnd = new Date(
    now.getTime() +
      REMINDER_WINDOW_HOURS * 60 * 60 * 1000
  );

  const rows =
    (await supabase(
      env,
      `vip_memberships?kicked_at=is.null&reminded_at=is.null` +
        `&expires_at=gte.${encodeURIComponent(now.toISOString())}` +
        `&expires_at=lte.${encodeURIComponent(windowEnd.toISOString())}`
    )) || [];

  let sent = 0;

  for (const membership of rows) {
    try {
      const text =
        `⏰ PENGINGAT\n\nMasa aktif VIP kamu akan berakhir dalam waktu kurang dari 24 jam.\n\nPerpanjang sekarang supaya tidak terputus.`;

      await sendMessage(
        env,
        membership.telegram_id,
        text
      );

      await supabase(
        env,
        `vip_memberships?id=eq.${Number(membership.id)}`,
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

/**
 * Member VIP yang expires_at-nya sudah lewat akan di-kick otomatis
 * (ban lalu unban) dari channel terkait, lalu diberi tahu lewat DM.
 */
async function kickExpiredVipMembers(env) {
  const nowIso = new Date().toISOString();

  const rows =
    (await supabase(
      env,
      `vip_memberships?kicked_at=is.null&expires_at=lt.${encodeURIComponent(nowIso)}`
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
        `vip_memberships?id=eq.${Number(membership.id)}`,
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

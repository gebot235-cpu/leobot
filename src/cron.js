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

import {
  checkPendingPayments,
} from "./payment.js";

/**
 * Dipanggil dari export `scheduled` di index.js.
 *
 * Urutan Cron:
 * 1. Cek transaksi PENDING ke BuatQris.
 * 2. Jika sudah dibayar, proses menjadi PAID dan kirim produk.
 * 3. Setelah itu baru expire order yang benar-benar sudah lewat.
 * 4. Reminder VIP.
 * 5. Kick VIP yang sudah expired.
 */
export async function runCronTasks(env) {
  const results = {
    pendingPayments: 0,
    expiredOrders: 0,
    reminders: 0,
    kicked: 0,
    errors: [],
  };

  /*
   * =========================================================
   * 1. CEK PEMBAYARAN PENDING
   * =========================================================
   *
   * Ini menjadi fallback jika webhook BuatQris tidak masuk.
   */
  try {
    const result =
      await checkPendingPayments(env);

    /*
     * checkPendingPayments() boleh mengembalikan angka.
     * Kalau versi payment.js tidak mengembalikan angka,
     * tetap dianggap berhasil dijalankan.
     */
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

  /*
   * =========================================================
   * 2. EXPIRE ORDER YANG BENAR-BENAR SUDAH KADALUARSA
   * =========================================================
   */
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

  /*
   * =========================================================
   * 3. REMINDER VIP
   * =========================================================
   */
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

  /*
   * =========================================================
   * 4. KICK VIP EXPIRED
   * =========================================================
   */
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

/**
 * Order yang QR-nya sudah lewat waktu tetapi belum dibayar
 * akan diubah menjadi EXPIRED.
 *
 * Fungsi ini dijalankan SETELAH checkPendingPayments().
 */
async function expirePendingOrders(env) {
  const nowIso =
    new Date().toISOString();

  const rows =
    await supabase(
      env,
      `orders?status=eq.PENDING&qr_expires_at=lt.${encodeURIComponent(
        nowIso
      )}`,
      "PATCH",
      {
        status:
          "EXPIRED",
      },
      {
        Prefer:
          "return=representation",
      }
    );

  return rows?.length || 0;
}

const REMINDER_WINDOW_HOURS = 24;

/**
 * Kirim reminder ke member VIP yang masa aktifnya akan habis
 * dalam REMINDER_WINDOW_HOURS jam ke depan.
 *
 * Hanya dikirim sekali per membership karena menggunakan
 * kolom reminded_at.
 */
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
      `vip_memberships?kicked_at=is.null&reminded_at=is.null` +
        `&expires_at=gte.${encodeURIComponent(
          now.toISOString()
        )}` +
        `&expires_at=lte.${encodeURIComponent(
          windowEnd.toISOString()
        )}`
    )) || [];

  let sent = 0;

  for (
    const membership of rows
  ) {
    try {
      const text =
        `⏰ PENGINGAT\n\n` +
        `Masa aktif VIP kamu akan berakhir ` +
        `dalam waktu kurang dari 24 jam.\n\n` +
        `Perpanjang sekarang supaya tidak terputus.`;

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

/**
 * Member VIP yang expires_at-nya sudah lewat akan di-kick
 * otomatis dari channel terkait, lalu diberi tahu lewat DM.
 */
async function kickExpiredVipMembers(env) {
  const nowIso =
    new Date().toISOString();

  const rows =
    (await supabase(
      env,
      `vip_memberships?kicked_at=is.null&expires_at=lt.${encodeURIComponent(
        nowIso
      )}`
    )) || [];

  let kicked = 0;

  for (
    const membership of rows
  ) {
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

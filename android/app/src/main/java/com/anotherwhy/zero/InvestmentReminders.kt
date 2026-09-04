package com.anotherwhy.zero

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale
import java.util.UUID

class ZeroInvestmentReminders(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {
  override fun getName() = "ZeroInvestmentReminders"

  @ReactMethod
  fun sync(rowsJson: String, promise: Promise) = respond(promise) {
    ReminderStore.replace(reactApplicationContext, ReminderStore.parse(rowsJson))
    null
  }

  @ReactMethod
  fun clear(promise: Promise) = respond(promise) {
    ReminderStore.replace(reactApplicationContext, emptyList())
    null
  }

  @ReactMethod
  fun isEnabled(promise: Promise) = respond(promise) {
    ReminderStore.enabled(reactApplicationContext)
  }

  private fun respond(promise: Promise, work: () -> Any?) {
    try {
      promise.resolve(synchronized(ReminderStore.lock) { work() })
    } catch (error: Exception) {
      promise.reject("E_INVESTMENT_REMINDERS", "Could not update investment reminders. ${error.message}", error)
    }
  }
}

class InvestmentRemindersPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
      listOf(ZeroInvestmentReminders(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
      emptyList()
}

/** Register in the default app process, exported=false, with BOOT_COMPLETED,
 * TIMEZONE_CHANGED, TIME_SET and MY_PACKAGE_REPLACED filters. Never directBootAware:
 * the scheduling metadata belongs in credential-protected, app-private storage. */
class InvestmentReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try {
      synchronized(ReminderStore.lock) { ReminderStore.receive(context, intent) }
    } catch (error: Exception) {
      // Receivers have no Promise consumer. Report failure without logging IDs/payloads.
      Log.e("ZeroInvestmentReminders", "Reminder delivery/rescheduling failed (${error.javaClass.simpleName}).")
    }
  }
}

private object ReminderStore {
  val lock = Any()
  private const val PREFS = "zero_investment_reminders"
  private const val KEY = "schedule"
  private const val CHANNEL = "zero_investment_reminders"
  private const val ACTION = "com.anotherwhy.zero.INVESTMENT_REMINDER"
  private const val TAG_PREFIX = "zero.investment.reminder:"
  private const val MAX_ROWS = 100
  private const val WINDOW_MS = 15 * 60 * 1000L
  private val monthPattern = Regex("[0-9]{4}-(0[1-9]|1[0-2])")

  data class Row(val id: String, val day: Int, val completedMonth: String,
      val startMonth: String, val deliveredMonth: String = "") {
    fun json() = JSONObject().put("id", id).put("day", day)
        .put("completedMonth", completedMonth).put("startMonth", startMonth)
        .put("deliveredMonth", deliveredMonth)
  }

  data class State(val generation: String, val rows: List<Row>, val retired: JSONArray = JSONArray())

  fun parse(json: String): List<Row> {
    require(json.length <= 65536) { "Reminder data is too large." }
    return parseRows(JSONArray(json))
  }

  private fun parseRows(array: JSONArray): List<Row> {
    require(array.length() <= MAX_ROWS) { "At most $MAX_ROWS active reminders are supported." }
    val ids = HashSet<String>()
    return (0 until array.length()).map { index ->
      val item = array.getJSONObject(index)
      val id = item.get("id") as? String
      require(id != null && id.isNotBlank() && id.length <= 256 && ids.add(id)) {
        "Reminder IDs must be unique, non-empty strings of at most 256 characters."
      }
      val day = item.get("day") as? Number
      require(day != null && day.toDouble() in 1.0..31.0 && day.toDouble() == day.toInt().toDouble()) {
        "Reminder day must be an integer between 1 and 31."
      }
      val completed = item.get("completedMonth") as? String
      val start = item.get("startMonth") as? String
      require(completed != null && (completed.isEmpty() || validMonth(completed))) {
        "Reviewed month must be YYYY-MM or empty."
      }
      require(start != null && validMonth(start)) { "Start month must be YYYY-MM." }
      // Deliberate allowlist: extra JS fields and supplied delivery markers never persist.
      Row(id, day.toInt(), completed, start)
    }
  }

  private fun validMonth(value: String) = monthPattern.matches(value) && value.take(4) != "0000"
  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private fun read(context: Context): State {
    val raw = prefs(context).getString(KEY, null) ?: return State("", emptyList())
    val json = JSONObject(raw)
    val rows = json.getJSONArray("rows")
    return State(json.getString("generation"), parseRows(rows).mapIndexed { index, row ->
      val delivered = rows.getJSONObject(index).optString("deliveredMonth", "")
      require(delivered.isEmpty() || validMonth(delivered)) { "Invalid reminder delivery metadata." }
      row.copy(deliveredMonth = delivered)
    }, json.optJSONArray("retired") ?: JSONArray())
  }

  private fun write(context: Context, state: State) {
    val editor = prefs(context).edit()
    if (state.rows.isEmpty() && state.retired.length() == 0) {
      editor.clear()
    } else {
      editor.putString(KEY, JSONObject().put("generation", state.generation)
          .put("rows", JSONArray(state.rows.map { it.json() }))
          .put("retired", state.retired).toString())
    }
    check(editor.commit()) { "Could not save reminder settings. Please try again." }
  }

  /** One persisted snapshot is the authority. Retired alarm identities are a cleanup
   * journal so interruption after a commit cannot make clear() lose old alarms. */
  fun replace(context: Context, incoming: List<Row>) {
    val old = cleanRetired(context, read(context))
    val delivered = old.rows.associate { it.id to it.deliveredMonth }
    val retired = JSONArray(old.rows.map {
      JSONObject().put("id", it.id).put("generation", old.generation)
    })
    val next = State(UUID.randomUUID().toString(), incoming.map {
      it.copy(deliveredMonth = delivered[it.id] ?: "")
    }, retired)
    val prepared = old.copy(retired = JSONArray(next.rows.map {
      JSONObject().put("id", it.id).put("generation", next.generation)
    }))
    // Prepare different PendingIntents without disturbing the old generation.
    // No receiver can observe an intermediate replacement under the shared lock.
    try {
      // Journal candidate identities before touching AlarmManager. If interrupted,
      // old remains authoritative and the next operation can cancel every candidate.
      write(context, prepared)
      next.rows.forEach { schedule(context, next.generation, it) }
      write(context, next)
    } catch (error: Exception) {
      // commit(false) can still change the in-memory SharedPreferences snapshot.
      try {
        write(context, prepared)
        cleanRetired(context, prepared)
      } catch (rollback: Exception) { error.addSuppressed(rollback) }
      throw error
    }
    cleanRetired(context, next)
    // Also remove displayed reminders for reviewed/removed rows, including survivors
    // of an interrupted cleanup. Do not cancel other app notifications.
    val manager = notifications(context)
    manager.activeNotifications.filter { it.tag?.startsWith(TAG_PREFIX) == true }
        .forEach { manager.cancel(it.tag, it.id) }
  }

  private fun cleanRetired(context: Context, state: State): State {
    for (index in 0 until state.retired.length()) {
      val item = state.retired.getJSONObject(index)
      val id = item.getString("id")
      cancelAlarm(context, item.getString("generation"), id)
      notifications(context).cancel(TAG_PREFIX + id, notificationId(id))
    }
    if (state.retired.length() == 0) return state
    return state.copy(retired = JSONArray()).also { write(context, it) }
  }

  private fun month(calendar: Calendar): String = String.format(Locale.US, "%04d-%02d",
      calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1)

  private fun monthCalendar(value: String): Calendar = Calendar.getInstance().apply {
    clear()
    set(value.take(4).toInt(), value.takeLast(2).toInt() - 1, 1, 9, 0, 0)
  }

  private fun due(row: Row, value: String): Long = monthCalendar(value).run {
    set(Calendar.DAY_OF_MONTH, minOf(row.day, getActualMaximum(Calendar.DAY_OF_MONTH)))
    timeInMillis
  }

  private fun nextMonth(value: String): String = monthCalendar(value).run {
    add(Calendar.MONTH, 1)
    month(this)
  }

  private fun schedule(context: Context, generation: String, row: Row) {
    val now = System.currentTimeMillis()
    var target = maxOf(month(Calendar.getInstance()), row.startMonth)
    // A high-water mark prevents repeats after clock/timezone rollback.
    if (row.deliveredMonth >= target) target = nextMonth(row.deliveredMonth)
    if (row.completedMonth == target) target = nextMonth(target)
    val trigger = maxOf(due(row, target), now + 1000L)
    val intent = alarmIntent(context, generation, row.id).putExtra("month", target)
    val pending = PendingIntent.getBroadcast(context, 0, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    alarms(context).setWindow(AlarmManager.RTC_WAKEUP, trigger, WINDOW_MS, pending)
  }

  private fun alarmIntent(context: Context, generation: String, id: String) =
      Intent(context, InvestmentReminderReceiver::class.java).setAction(ACTION)
          .setData(Uri.Builder().scheme("zero-reminder").authority("investment")
              .appendPath(generation).appendPath(id).build())

  private fun cancelAlarm(context: Context, generation: String, id: String) {
    val pending = PendingIntent.getBroadcast(context, 0, alarmIntent(context, generation, id),
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE) ?: return
    alarms(context).cancel(pending)
    pending.cancel()
  }

  private fun alarms(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  private fun notifications(context: Context) =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  private fun notificationId(id: String) = (TAG_PREFIX + id).hashCode() and 0x7fffffff

  fun enabled(context: Context): Boolean {
    val manager = notifications(context)
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL,
          "Investment reminders", NotificationManager.IMPORTANCE_DEFAULT))
    }
    if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
        PackageManager.PERMISSION_GRANTED) return false
    if (!manager.areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= 26) {
      val channel = manager.getNotificationChannel(CHANNEL) ?: return false
      if (channel.importance == NotificationManager.IMPORTANCE_NONE) return false
      if (Build.VERSION.SDK_INT >= 28 && channel.group != null &&
          manager.getNotificationChannelGroup(channel.group)?.isBlocked == true) return false
    }
    return true
  }

  fun receive(context: Context, intent: Intent) {
    if (intent.action !in setOf(ACTION, Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIMEZONE_CHANGED,
        Intent.ACTION_TIME_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED)) return
    var state = cleanRetired(context, read(context))
    if (intent.action != ACTION) {
      state.rows.forEach { schedule(context, state.generation, it) }
      return
    }
    val uri = intent.data ?: return
    if (uri.scheme != "zero-reminder" || uri.authority != "investment" || uri.pathSegments.size != 2) return
    if (uri.pathSegments[0] != state.generation) return // Old sync, removed row, or clear.
    val row = state.rows.find { it.id == uri.pathSegments[1] } ?: return
    val currentMonth = month(Calendar.getInstance())
    val alarmMonth = intent.getStringExtra("month")
    if (alarmMonth != currentMonth || currentMonth < row.startMonth ||
        currentMonth == row.completedMonth || currentMonth <= row.deliveredMonth ||
        System.currentTimeMillis() < due(row, currentMonth)) {
      schedule(context, state.generation, row)
      return
    }
    // Persist before posting: at-most-once delivery, even if the process dies between
    // notify and rearming. Denied permission skips this month without a retry loop.
    val handled = row.copy(deliveredMonth = currentMonth)
    state = state.copy(rows = state.rows.map { if (it.id == row.id) handled else it })
    write(context, state)
    try {
      if (enabled(context)) post(context, row.id)
    } catch (error: SecurityException) {
      Log.w("ZeroInvestmentReminders", "Notification permission unavailable at delivery.")
    } finally {
      schedule(context, state.generation, handled)
    }
  }

  @Suppress("DEPRECATION")
  private fun post(context: Context, id: String) {
    val launch = Intent(context, MainActivity::class.java)
        .setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val content = PendingIntent.getActivity(context, 0, launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL)
        else Notification.Builder(context)
    val notification = builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
        .setContentTitle("Monthly valuation reminder")
        .setContentText("Open Investing in Zero to update a due investment.")
        .setContentIntent(content).setAutoCancel(true).setOnlyAlertOnce(true)
        .setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE).build()
    // The opaque tag disambiguates hash collisions; the ID remains deterministic.
    notifications(context).notify(TAG_PREFIX + id, notificationId(id), notification)
  }
}

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'

export interface NotificationRecord {
  id: number
  type: string
  title: string
  body: string
  data: string | null
  read: number
  receivedAt: string
}

let db: SQLiteDatabase | null = null

export async function getNotificationDB(): Promise<SQLiteDatabase> {
  if (!db) {
    db = await openDatabaseAsync('animewatch_notifications.db')
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'general',
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        receivedAt TEXT NOT NULL
      )
    `)
  }
  return db
}

export async function getAllNotifications(): Promise<NotificationRecord[]> {
  const d = await getNotificationDB()
  return d.getAllAsync<NotificationRecord>(
    'SELECT * FROM notifications ORDER BY receivedAt DESC',
  )
}

export async function getUnreadCount(): Promise<number> {
  const d = await getNotificationDB()
  const row = await d.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM notifications WHERE read = 0',
  )
  return row?.count ?? 0
}

export async function insertNotification(
  type: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const d = await getNotificationDB()
  await d.runAsync(
    `INSERT INTO notifications (type, title, body, data, read, receivedAt)
     VALUES (?, ?, ?, ?, 0, ?)`,
    type,
    title,
    body,
    data ? JSON.stringify(data) : null,
    new Date().toISOString(),
  )
}

export async function markAsRead(id: number): Promise<void> {
  const d = await getNotificationDB()
  await d.runAsync('UPDATE notifications SET read = 1 WHERE id = ?', id)
}

export async function markAllAsRead(): Promise<void> {
  const d = await getNotificationDB()
  await d.runAsync('UPDATE notifications SET read = 1 WHERE read = 0')
}

export async function deleteNotification(id: number): Promise<void> {
  const d = await getNotificationDB()
  await d.runAsync('DELETE FROM notifications WHERE id = ?', id)
}

export async function clearAllNotifications(): Promise<void> {
  const d = await getNotificationDB()
  await d.runAsync('DELETE FROM notifications')
}

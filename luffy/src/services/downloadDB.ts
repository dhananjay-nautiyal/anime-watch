import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'

export interface DownloadRecord {
  id: number
  animeId: number | null
  animeSlug: string
  animeTitle: string
  animeImage: string | null
  episodeNumber: number
  episodeTitle: string | null
  episodeUrl: string
  streamUrl: string
  language: string
  serverInfo: string | null
  status: 'downloading' | 'paused' | 'completed' | 'failed'
  progress: number
  totalBytes: number
  downloadedBytes: number
  fileUri: string | null
  localPlaylistPath: string | null
  segmentsTotal: number
  segmentsCompleted: number
  createdAt: string
  updatedAt: string
}

let db: SQLiteDatabase | null = null

export async function getDB(): Promise<SQLiteDatabase> {
  if (!db) {
    db = await openDatabaseAsync('animewatch_downloads.db')
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        animeId INTEGER,
        animeSlug TEXT NOT NULL,
        animeTitle TEXT NOT NULL,
        animeImage TEXT,
        episodeNumber INTEGER NOT NULL,
        episodeTitle TEXT,
        episodeUrl TEXT NOT NULL,
        streamUrl TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'SUB',
        serverInfo TEXT,
        status TEXT NOT NULL DEFAULT 'downloading',
        progress REAL DEFAULT 0,
        totalBytes INTEGER DEFAULT 0,
        downloadedBytes INTEGER DEFAULT 0,
        fileUri TEXT,
        localPlaylistPath TEXT,
        segmentsTotal INTEGER DEFAULT 0,
        segmentsCompleted INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(animeSlug, episodeNumber)
      )
    `)
  }
  return db
}

export async function getAllDownloads(): Promise<DownloadRecord[]> {
  const d = await getDB()
  return d.getAllAsync<DownloadRecord>('SELECT * FROM downloads ORDER BY updatedAt DESC')
}

export async function getDownloadsByAnime(slug: string): Promise<DownloadRecord[]> {
  const d = await getDB()
  return d.getAllAsync<DownloadRecord>(
    'SELECT * FROM downloads WHERE animeSlug = ? ORDER BY episodeNumber ASC', slug,
  )
}

export async function getDownload(animeSlug: string, episodeNumber: number): Promise<DownloadRecord | null> {
  const d = await getDB()
  return d.getFirstAsync<DownloadRecord>(
    'SELECT * FROM downloads WHERE animeSlug = ? AND episodeNumber = ?',
    animeSlug, episodeNumber,
  ) ?? null
}

export async function insertDownload(rec: DownloadRecord): Promise<void> {
  const d = await getDB()
  await d.runAsync(
    `INSERT OR REPLACE INTO downloads
      (animeId, animeSlug, animeTitle, animeImage, episodeNumber, episodeTitle,
       episodeUrl, streamUrl, language, serverInfo, status, progress,
       totalBytes, downloadedBytes, fileUri, localPlaylistPath,
       segmentsTotal, segmentsCompleted, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rec.animeId, rec.animeSlug, rec.animeTitle, rec.animeImage,
    rec.episodeNumber, rec.episodeTitle,
    rec.episodeUrl, rec.streamUrl, rec.language, rec.serverInfo,
    rec.status, rec.progress, rec.totalBytes, rec.downloadedBytes,
    rec.fileUri, rec.localPlaylistPath,
    rec.segmentsTotal, rec.segmentsCompleted, rec.createdAt, rec.updatedAt,
  )
}

export async function updateDownloadStatus(
  id: number,
  updates: Partial<Pick<DownloadRecord, 'status' | 'progress' | 'downloadedBytes' | 'totalBytes' | 'segmentsTotal' | 'segmentsCompleted' | 'fileUri' | 'localPlaylistPath' | 'updatedAt'>>,
): Promise<void> {
  const d = await getDB()
  const setClauses: string[] = []
  const params: any[] = []
  for (const [key, val] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`)
    params.push(val)
  }
  if (setClauses.length > 0) {
    params.push(id)
    await d.runAsync(`UPDATE downloads SET ${setClauses.join(', ')} WHERE id = ?`, ...params)
  }
}

export async function deleteDownload(id: number): Promise<void> {
  const d = await getDB()
  await d.runAsync('DELETE FROM downloads WHERE id = ?', id)
}

export async function getDownloadStats(): Promise<{
  totalDownloads: number
  completedDownloads: number
  totalBytes: number
  animeCount: number
}> {
  const d = await getDB()
  const summary = await d.getFirstAsync<any>(
    `SELECT
      COUNT(*) as totalDownloads,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedDownloads,
      COALESCE(SUM(totalBytes), 0) as totalBytes
     FROM downloads`,
  )
  const animeCount = await d.getFirstAsync<any>(
    'SELECT COUNT(DISTINCT animeSlug) as count FROM downloads WHERE status = ?',
    'completed',
  )
  return {
    totalDownloads: summary?.totalDownloads ?? 0,
    completedDownloads: summary?.completedDownloads ?? 0,
    totalBytes: summary?.totalBytes ?? 0,
    animeCount: animeCount?.count ?? 0,
  }
}

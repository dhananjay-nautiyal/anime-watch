import { Paths, File, Directory, DownloadTask, type DownloadProgress } from 'expo-file-system'
import { Platform } from 'react-native'
import {
  getDB, insertDownload, updateDownloadStatus, deleteDownload,
  getDownload, getDownloadStats, getAllDownloads,
  type DownloadRecord,
} from './downloadDB'

const cacheDir = Paths.cache

export type DownloadEventType = 'progress' | 'completed' | 'failed' | 'paused' | 'added' | 'removed' | 'stats'

export interface DownloadEvent {
  type: DownloadEventType
  animeSlug: string
  episodeNumber: number
  progress?: number
  downloadedBytes?: number
  totalBytes?: number
  error?: string
}

export interface DownloadItem {
  id: number
  title: string
  animeTitle: string
  animeSlug: string
  episodeNumber: number
  imageUrl: string | null
  progress: number
  status: string
  totalBytes: number
  downloadedBytes: number
  createdAt: string
}

let activeDownloads = new Map<number, { task: DownloadTask | null; abort: boolean }>()
let listeners = new Set<(event: DownloadEvent) => void>()
let maxConcurrent = Platform.OS === 'android' ? 3 : 2
let activeCount = 0
let pendingQueue: Array<{ animeSlug: string; episodeNumber: number }> = []

function emit(event: DownloadEvent) {
  listeners.forEach(l => { try { l(event) } catch {} })
}

export function addDownloadListener(fn: (event: DownloadEvent) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function ensureDir(path: string): Promise<Directory> {
  const dir = new Directory(path)
  await dir.create({ intermediates: true })
  return dir
}

function parseHlsSegments(playlist: string): string[] {
  const segments: string[] = []
  for (const line of playlist.split('\n')) {
    const t = line.trim()
    if (t && !t.startsWith('#') && (t.endsWith('.ts') || t.includes('.ts?'))) {
      segments.push(t)
    }
  }
  return segments
}

function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative
  const idx = base.lastIndexOf('/')
  return (idx >= 0 ? base.slice(0, idx + 1) : base + '/') + relative
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

export function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
  catch { return iso }
}

export async function getFreeStorageBytes(): Promise<number> {
  try { return Paths.availableDiskSpace } catch { return Number.MAX_SAFE_INTEGER }
}

export async function checkStorage(bytesNeeded: number): Promise<boolean> {
  const free = await getFreeStorageBytes()
  return free >= bytesNeeded
}

export async function getDownloadSize(): Promise<number> {
  try {
    const stats = await getDownloadStats()
    return stats.totalBytes
  } catch { return 0 }
}

export async function startDownload(
  animeSlug: string,
  episodeNumber: number,
  streamUrl: string,
  metadata: {
    animeId?: number
    animeTitle: string
    animeImage?: string
    episodeTitle?: string
    episodeUrl?: string
    language?: string
  },
): Promise<void> {
  const existing = await getDownload(animeSlug, episodeNumber)
  if (existing && (existing.status === 'downloading' || existing.status === 'completed')) return

  const now = new Date().toISOString()
  await insertDownload({
    id: 0,
    animeId: metadata.animeId ?? null,
    animeSlug,
    animeTitle: metadata.animeTitle,
    animeImage: metadata.animeImage ?? null,
    episodeNumber,
    episodeTitle: metadata.episodeTitle ?? null,
    episodeUrl: metadata.episodeUrl ?? '',
    streamUrl,
    language: metadata.language ?? 'SUB',
    serverInfo: null,
    status: 'downloading',
    progress: 0,
    totalBytes: 0,
    downloadedBytes: 0,
    fileUri: null,
    localPlaylistPath: null,
    segmentsTotal: 0,
    segmentsCompleted: 0,
    createdAt: now,
    updatedAt: now,
  })

  pendingQueue.push({ animeSlug, episodeNumber })
  emit({ type: 'added', animeSlug, episodeNumber })
  processQueue()
}

async function processQueue() {
  if (activeCount >= maxConcurrent || pendingQueue.length === 0) return
  const next = pendingQueue.shift()!
  activeCount++
  try { await processDownload(next.animeSlug, next.episodeNumber) }
  catch (e) { console.warn('download process error:', e) }
  activeCount--
  processQueue()
}

async function processDownload(animeSlug: string, episodeNumber: number) {
  const rec = await getDownload(animeSlug, episodeNumber)
  if (!rec || rec.status === 'completed' || rec.status === 'failed') return

  const episodeDirPath = `${cacheDir.uri}downloads/${animeSlug}/ep_${episodeNumber}/`
  await ensureDir(episodeDirPath)

  try {
    // Fetch HLS playlist
    const response = await fetch(rec.streamUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const playlist = await response.text()

    const rawSegments = parseHlsSegments(playlist)
    const segmentUrls = rawSegments.map(s => resolveUrl(rec.streamUrl, s))

    if (segmentUrls.length === 0) {
      await downloadAsSingleFile(rec, episodeDirPath)
      return
    }

    const totalSegments = segmentUrls.length
    await updateDownloadStatus(rec.id, { segmentsTotal: totalSegments, totalBytes: 0 })

    // Build local playlist
    let localPlaylist = '#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n'
    const lines = playlist.split('\n')
    for (const line of lines) {
      const t = line.trim()
      if (t.startsWith('#EXTINF') || t.startsWith('#EXT-X-')) {
        localPlaylist += t + '\n'
      }
    }

    let completedSegments = 0
    let totalBytes = 0
    let downloadedBytes = 0

    if (activeDownloads.has(rec.id)) {
      activeDownloads.set(rec.id, { task: null, abort: false })
    }

    for (let i = 0; i < segmentUrls.length; i++) {
      const state = activeDownloads.get(rec.id)
      if (state?.abort) {
        await updateDownloadStatus(rec.id, { status: 'paused', updatedAt: new Date().toISOString() })
        emit({ type: 'paused', animeSlug, episodeNumber })
        return
      }

      const segUrl = segmentUrls[i]
      const ext = segUrl.split('.').pop()?.split('?')[0] || 'ts'
      const segPath = episodeDirPath + `seg_${i.toString().padStart(4, '0')}.${ext}`

      try {
        const result = await FileSystemDownload(segUrl, segPath)
        if (result) totalBytes += result
        downloadedBytes += result ?? 0
      } catch {
        // continue with next segment
      }

      completedSegments++
      const progress = totalSegments > 0 ? completedSegments / totalSegments : 0
      await updateDownloadStatus(rec.id, {
        progress,
        downloadedBytes,
        totalBytes,
        segmentsCompleted: completedSegments,
        updatedAt: new Date().toISOString(),
      })
      emit({ type: 'progress', animeSlug, episodeNumber, progress, downloadedBytes, totalBytes })

      localPlaylist += `#EXTINF:10,\nseg_${i.toString().padStart(4, '0')}.${ext}\n`
    }

    localPlaylist += '#EXT-X-ENDLIST\n'
    const playlistFile = new File(episodeDirPath + 'playlist.m3u8')
    await playlistFile.write(localPlaylist)

    const finalProgress = totalSegments > 0 ? completedSegments / totalSegments : 0
    const status = completedSegments > 0 ? 'completed' : 'failed'

    await updateDownloadStatus(rec.id, {
      status,
      progress: finalProgress,
      localPlaylistPath: episodeDirPath + 'playlist.m3u8',
      segmentsCompleted: completedSegments,
      updatedAt: new Date().toISOString(),
    })

    emit({ type: status === 'completed' ? 'completed' : 'failed', animeSlug, episodeNumber, progress: finalProgress, totalBytes })

  } catch (err: any) {
    await updateDownloadStatus(rec.id, { status: 'failed', updatedAt: new Date().toISOString() })
    emit({ type: 'failed', animeSlug, episodeNumber, error: err?.message })
  }
}

// Download a single file and return its size
async function FileSystemDownload(url: string, dest: string): Promise<number | null> {
  const file = new File(dest)
  const task = new DownloadTask(url, file)
  try {
    const result = await task.downloadAsync()
    return result ? 1 : null
  } catch { return null }
}

async function downloadAsSingleFile(rec: DownloadRecord, dirPath: string) {
  const dest = dirPath + 'video.mp4'
  const file = new File(dest)
  const downloadTask = new DownloadTask(rec.streamUrl, file)

  activeDownloads.set(rec.id, { task: downloadTask, abort: false })

  downloadTask.addListener('progress', (data: DownloadProgress) => {
    const total = data.totalBytes ?? 1
    const downloaded = data.bytesWritten ?? 0
    const progress = total > 0 ? downloaded / total : 0

    updateDownloadStatus(rec.id, { progress, downloadedBytes: downloaded, totalBytes: total, updatedAt: new Date().toISOString() }).catch(() => {})
    emit({ type: 'progress', animeSlug: rec.animeSlug, episodeNumber: rec.episodeNumber, progress, downloadedBytes: downloaded, totalBytes: total })
  })

  try {
    await downloadTask.downloadAsync()
    await updateDownloadStatus(rec.id, { status: 'completed', progress: 1, fileUri: dest, updatedAt: new Date().toISOString() })
    emit({ type: 'completed', animeSlug: rec.animeSlug, episodeNumber: rec.episodeNumber, progress: 1 })
  } catch (err: any) {
    await updateDownloadStatus(rec.id, { status: 'failed', updatedAt: new Date().toISOString() })
    emit({ type: 'failed', animeSlug: rec.animeSlug, episodeNumber: rec.episodeNumber, error: err?.message })
  } finally {
    activeDownloads.delete(rec.id)
  }
}

export async function cancelDownload(animeSlug: string, episodeNumber: number): Promise<void> {
  const rec = await getDownload(animeSlug, episodeNumber)
  if (!rec) return
  const state = activeDownloads.get(rec.id)
  if (state) {
    state.abort = true
    try { state.task?.cancel() } catch {}
  }
  await updateDownloadStatus(rec.id, { status: 'paused', updatedAt: new Date().toISOString() })
  emit({ type: 'paused', animeSlug, episodeNumber })
}

export async function removeDownload(animeSlug: string, episodeNumber: number): Promise<void> {
  const rec = await getDownload(animeSlug, episodeNumber)
  if (!rec) return

  const state = activeDownloads.get(rec.id)
  if (state) {
    state.abort = true
    try { state.task?.cancel() } catch {}
  }

  try {
    const dir = new Directory(`${cacheDir.uri}downloads/${animeSlug}/ep_${episodeNumber}/`)
    await dir.delete()
  } catch {}
  if (rec.fileUri) {
    try { await new File(rec.fileUri).delete() } catch {}
  }

  await deleteDownload(rec.id)
  emit({ type: 'removed', animeSlug, episodeNumber })
}

export async function resumeDownload(animeSlug: string, episodeNumber: number): Promise<void> {
  const rec = await getDownload(animeSlug, episodeNumber)
  if (!rec || rec.status !== 'paused') return
  await updateDownloadStatus(rec.id, { status: 'downloading', progress: 0, downloadedBytes: 0, updatedAt: new Date().toISOString() })
  pendingQueue.push({ animeSlug, episodeNumber })
  emit({ type: 'added', animeSlug, episodeNumber })
  processQueue()
}

export async function clearCompletedDownloads(): Promise<void> {
  const all = await getAllDownloads()
  for (const rec of all) {
    if (rec.status === 'completed') {
      await removeDownload(rec.animeSlug, rec.episodeNumber)
    }
  }
}

export async function loadDownloadItems(): Promise<DownloadItem[]> {
  const all = await getAllDownloads()
  return all.map(r => ({
    id: r.id,
    title: r.episodeTitle || `Episode ${r.episodeNumber}`,
    animeTitle: r.animeTitle,
    animeSlug: r.animeSlug,
    episodeNumber: r.episodeNumber,
    imageUrl: r.animeImage,
    progress: r.progress,
    status: r.status,
    totalBytes: r.totalBytes,
    downloadedBytes: r.downloadedBytes,
    createdAt: r.createdAt,
  }))
}

export { getDownloadStats, getDownload }

export async function getLocalFileUri(animeSlug: string, episodeNumber: number): Promise<string | null> {
  const rec = await getDownload(animeSlug, episodeNumber)
  if (!rec || rec.status !== 'completed') return null
  return rec.localPlaylistPath || rec.fileUri || null
}

package expo.modules.realmvideotrim

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer
import java.util.UUID

/** Reaches the app as code ERR_TRIM_FAILED, with a message people can read. */
class TrimFailedException(message: String, cause: Throwable? = null) :
  CodedException(message, cause)

/**
 * Cuts the part of a video between two times into a new file without making the video again: the
 * frames and sound are copied as they are (MediaExtractor into MediaMuxer), so it takes a moment
 * even for a long video and keeps its quality. The cut starts on the key frame at or just before
 * the start time, which is where a video can begin playing.
 */
class RealmVideoTrimModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RealmVideoTrim")

    AsyncFunction("trimAsync") { uri: String, startMs: Double, endMs: Double ->
      trim(uri, startMs.toLong(), endMs.toLong())
    }
  }

  private fun isFile(source: Uri) = source.scheme == null || source.scheme == "file"

  private fun pathOf(source: Uri, raw: String) = source.path ?: raw

  private fun rotationOf(source: Uri, raw: String): Int {
    val retriever = MediaMetadataRetriever()
    return try {
      if (isFile(source)) retriever.setDataSource(pathOf(source, raw))
      else retriever.setDataSource(context, source)
      when (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull()) {
        90 -> 90
        180 -> 180
        270 -> 270
        else -> 0
      }
    } catch (e: Exception) {
      0
    } finally {
      runCatching { retriever.release() }
    }
  }

  private fun trim(uri: String, startMs: Long, endMs: Long): Map<String, Any> {
    if (startMs < 0 || endMs - startMs < 500) {
      throw TrimFailedException("Choose a part at least half a second long.")
    }
    val source = Uri.parse(uri)
    val out = File(context.cacheDir, "realm-trim-${UUID.randomUUID()}.mp4")
    val extractor = MediaExtractor()
    var muxer: MediaMuxer? = null
    var started = false
    var stopped = false
    var firstUs = 0L
    var lastVideoUs = 0L
    try {
      if (isFile(source)) extractor.setDataSource(pathOf(source, uri))
      else extractor.setDataSource(context, source, null)

      val made = MediaMuxer(out.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      muxer = made
      // Source track -> track in the new file. One picture track, and the sound.
      val tracks = HashMap<Int, Int>()
      var videoTrack = -1
      var bufferSize = 1 shl 20
      for (i in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(i)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        val video = mime.startsWith("video/")
        if (!video && !mime.startsWith("audio/")) continue
        if (video && videoTrack >= 0) continue
        tracks[i] = made.addTrack(format)
        if (video) videoTrack = i
        if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
          bufferSize = maxOf(bufferSize, format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE))
        }
      }
      if (videoTrack < 0) throw TrimFailedException("That file has no video in it.")
      made.setOrientationHint(rotationOf(source, uri))

      // Find the key frame the cut starts on, then line the sound up with it.
      extractor.selectTrack(videoTrack)
      extractor.seekTo(startMs * 1000, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      firstUs = extractor.sampleTime
      if (firstUs < 0) throw TrimFailedException("That part of the video is empty.")
      lastVideoUs = firstUs
      for (i in tracks.keys) if (i != videoTrack) extractor.selectTrack(i)
      extractor.seekTo(firstUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)

      val endUs = endMs * 1000
      val buffer = ByteBuffer.allocate(bufferSize)
      val info = MediaCodec.BufferInfo()
      val open = HashSet(tracks.keys)
      made.start()
      started = true
      while (open.isNotEmpty()) {
        val track = extractor.sampleTrackIndex
        if (track < 0) break
        val target = tracks[track]
        val time = extractor.sampleTime
        if (target == null) {
          extractor.advance()
          continue
        }
        if (time > endUs) {
          // This track is past the end; the others may still have a little left.
          extractor.unselectTrack(track)
          open.remove(track)
          continue
        }
        val size = extractor.readSampleData(buffer, 0)
        if (size < 0) break
        // Sound from before the first picture is left out.
        if (track == videoTrack || time >= firstUs) {
          val key = (extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0
          info.set(0, size, time, if (key) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
          made.writeSampleData(target, buffer, info)
          if (track == videoTrack) lastVideoUs = time
        }
        extractor.advance()
      }
      made.stop()
      stopped = true
    } catch (e: TrimFailedException) {
      out.delete()
      throw e
    } catch (e: Throwable) {
      out.delete()
      throw TrimFailedException("This video can't be trimmed on this phone.", e)
    } finally {
      runCatching { extractor.release() }
      if (started && !stopped) runCatching { muxer?.stop() }
      runCatching { muxer?.release() }
    }

    // Measure the new file: its length, and its shape as it's shown (turned by its rotation).
    val meta = MediaMetadataRetriever()
    try {
      meta.setDataSource(out.absolutePath)
      val w = meta.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val h = meta.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      val turn = meta.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val duration = meta.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
        ?: ((lastVideoUs - firstUs) / 1000)
      val sideways = turn == 90 || turn == 270
      return mapOf(
        "uri" to Uri.fromFile(out).toString(),
        "durationMs" to duration.toDouble(),
        "startMs" to firstUs / 1000.0,
        "width" to (if (sideways) h else w),
        "height" to (if (sideways) w else h),
        "sizeBytes" to out.length().toDouble(),
      )
    } catch (e: Throwable) {
      out.delete()
      throw TrimFailedException("This video can't be trimmed on this phone.", e)
    } finally {
      runCatching { meta.release() }
    }
  }
}

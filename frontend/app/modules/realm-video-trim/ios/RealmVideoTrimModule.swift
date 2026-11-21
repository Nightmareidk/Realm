import AVFoundation
import ExpoModulesCore

/// Cuts the part of a video between two times into a new file without making the video again
/// (AVAssetExportSession with the passthrough preset), so it's quick and keeps its quality.
public class RealmVideoTrimModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RealmVideoTrim")

    AsyncFunction("trimAsync") { (uri: URL, startMs: Double, endMs: Double, promise: Promise) in
      guard startMs >= 0, endMs - startMs >= 500 else {
        promise.reject("ERR_TRIM_FAILED", "Choose a part at least half a second long.")
        return
      }
      let asset = AVURLAsset(url: uri)
      guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough)
      else {
        promise.reject("ERR_TRIM_FAILED", "This video can't be trimmed on this phone.")
        return
      }
      let out = FileManager.default.temporaryDirectory
        .appendingPathComponent("realm-trim-\(UUID().uuidString).mp4")
      export.outputURL = out
      export.outputFileType = .mp4
      export.timeRange = CMTimeRange(
        start: CMTime(value: CMTimeValue(startMs), timescale: 1000),
        end: CMTime(value: CMTimeValue(endMs), timescale: 1000)
      )
      export.exportAsynchronously {
        guard export.status == .completed else {
          try? FileManager.default.removeItem(at: out)
          promise.reject("ERR_TRIM_FAILED", "This video can't be trimmed on this phone.")
          return
        }
        let made = AVURLAsset(url: out)
        var width = 0.0
        var height = 0.0
        if let track = made.tracks(withMediaType: .video).first {
          let size = track.naturalSize.applying(track.preferredTransform)
          width = abs(Double(size.width))
          height = abs(Double(size.height))
        }
        let attributes = try? FileManager.default.attributesOfItem(atPath: out.path)
        let bytes = (attributes?[.size] as? NSNumber)?.doubleValue ?? 0
        promise.resolve([
          "uri": out.absoluteString,
          "durationMs": CMTimeGetSeconds(made.duration) * 1000,
          "startMs": startMs,
          "width": width,
          "height": height,
          "sizeBytes": bytes,
        ])
      }
    }
  }
}

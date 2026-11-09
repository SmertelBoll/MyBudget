package expo.modules.receiptocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// On-device text recognition (ML Kit, Latin script) for receipt photos. Returns every recognized line with its box
// in image pixels; the app pairs names with prices by their rows (src/data/receiptParser.ts).
class ReceiptOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReceiptOcr")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw IllegalStateException("No context")
        val parsed = if (uri.startsWith("file://") || uri.startsWith("content://")) Uri.parse(uri) else Uri.fromFile(File(uri))
        // Reads the EXIF orientation too, so a photo taken sideways is recognized upright.
        val image = InputImage.fromFilePath(context, parsed)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(image)
          .addOnSuccessListener { result ->
            val lines = result.textBlocks.flatMap { block ->
              block.lines.mapNotNull { line ->
                val box = line.boundingBox ?: return@mapNotNull null
                mapOf(
                  "text" to line.text,
                  "left" to box.left,
                  "top" to box.top,
                  "right" to box.right,
                  "bottom" to box.bottom
                )
              }
            }
            recognizer.close()
            promise.resolve(mapOf("width" to image.width, "height" to image.height, "lines" to lines))
          }
          .addOnFailureListener { error ->
            recognizer.close()
            promise.reject(CodedException("ERR_RECOGNIZE", error.message ?: "Recognition failed", error))
          }
      } catch (error: Exception) {
        promise.reject(CodedException("ERR_RECOGNIZE", error.message ?: "Recognition failed", error))
      }
    }
  }
}

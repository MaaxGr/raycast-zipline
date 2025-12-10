import { Clipboard, closeMainWindow, showHUD } from "@raycast/api";
import { uploadContent, shortenUrl } from "./api";

export default async function Command() {
  try {
    await closeMainWindow();

    const clipboardContent = await Clipboard.read();

    if (!clipboardContent.text && !clipboardContent.file) {
      await showHUD("❌ Clipboard is empty");
      return;
    }

    if (clipboardContent.file) {
      const path = decodeURI(clipboardContent.file.replace("file://", ""));
      const isImageFromClipboard = path.startsWith("/var") && clipboardContent.text.includes("Image (");

      await showHUD("⏳ Uploading file...");
      await uploadContent({ filePath: path, forceImage: isImageFromClipboard });
      await showHUD(`✅ Uploaded! Link copied to clipboard`);
      return;
    }

    const text = clipboardContent.text.trim();
    const urlPattern = /^https?:\/\/[^\s]+$/;

    if (urlPattern.test(text)) {
      await showHUD("⏳ Shortening URL...");
      await shortenUrl(text);
      await showHUD(`✅ URL shortened! Link copied to clipboard`);
      return;
    }

    await showHUD("⏳ Uploading text...");
    await uploadContent({ textContent: text });
    await showHUD(`✅ Text uploaded! Link copied to clipboard`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    await showHUD(`❌ ${errorMessage}`);
  }
}

import { readdirSync, statSync } from "node:fs";
import { join } from "path";
import untildify from "untildify";
import * as fs from "node:fs";
import { getExtensionPreferences } from "./preferences";

const preferences = getExtensionPreferences();
export const downloadsFolder = untildify(preferences.defaultFileLocation);

export function createMarkdownImage(url: string) {
  return `![Image Preview](${url}?raycast-height=350)`;
}

export function getScreenshots() {
  const files = readdirSync(downloadsFolder);
  return files
    .filter((file) => !file.startsWith("."))
    .map((file) => {
      const path = join(downloadsFolder, file);
      const lastModifiedAt = statSync(path).mtime;
      return { file, path, lastModifiedAt };
    })
    .filter((file) => statSync(file.path).isFile())
    .sort((a, b) => b.lastModifiedAt.getTime() - a.lastModifiedAt.getTime());
}

export function isTextFile(filePath: string, sampleSize = 512) {
  try {
    const buffer = Buffer.alloc(sampleSize);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer as unknown as Uint8Array, 0, sampleSize, 0);
    fs.closeSync(fd);

    // Check for non-printable characters
    for (const byte of buffer) {
      //if (byte === 0) return false; // Null byte is a strong indicator of binary
      if (byte < 0x20 && ![0x09, 0x0a, 0x0d].includes(byte)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error reading file:", error);
    return false;
  }
}

export function readFirstCharacters(filePath: string, sampleSize: number): string {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(sampleSize);
    const bytesRead = fs.readSync(fd, buffer as unknown as Uint8Array, 0, sampleSize, 0);
    const content = buffer.toString("utf8", 0, bytesRead);

    fs.closeSync(fd);

    return content;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error reading file:", errorMessage);
    return "";
  }
}

export function containsMdSupportedExtension(filePath: string): boolean {
  const supportedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".bmp", ".ico", ".tiff", ".csv", ".pdf"];

  const lastDotIndex = filePath.lastIndexOf(".");

  if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
    return false; // No extension found or the file ends with a dot
  }

  const extension = filePath.substring(lastDotIndex).toLowerCase();
  return supportedExtensions.includes(extension);
}

export function isDisplayableMIMEType(mimeType: string): boolean {
  if (mimeType.startsWith("text/")) {
    return true;
  }

  const nonBinaryMimeTypes = [
    "text/plain",
    "text/html",
    "text/css",
    "application/javascript",
    "text/javascript",
    "application/json",
    "application/xml",
    "text/xml",
    "application/rss+xml",
    "application/atom+xml",
    "application/xslt+xml",
    "text/markdown",
    "text/sgml",
    "text/csv",
    "text/tab-separated-values",
    "application/x-yaml",
    "text/yaml",
    "text/x-python",
    "text/x-java-source",
    "application/x-perl",
    "application/x-ruby",
    "application/x-shellscript",
    "text/x-log",
    "text/vcard",
    "text/calendar",
  ];

  return nonBinaryMimeTypes.includes(mimeType.toLowerCase());
}

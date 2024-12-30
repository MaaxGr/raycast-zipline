import { readdirSync, statSync } from "node:fs";
import { join } from "path";
import untildify from "untildify";
import * as fs from "node:fs";
import { getExtensionPreferences } from "./preferences";

const preferences = getExtensionPreferences();
export const downloadsFolder = untildify(preferences.defaultFileLocation);

export function getScreenshots() {
  console.log("Getting screenshots from", downloadsFolder, "with force refresh");
  // Clear require cache if necessary (e.g., for dynamic imports)
  fs.closeSync(fs.openSync(downloadsFolder, "r")); // Access the directory to force a refresh

  const files = readdirSync(downloadsFolder);
  console.log("Found", files, "files in", downloadsFolder);
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
    fs.readSync(fd, buffer, 0, sampleSize, 0);
    fs.closeSync(fd);

    if (filePath.endsWith(".txt")) {
      console.log(buffer.toString());
    }

    // Check for non-printable characters (ASCII range 0x00-0x1F except 0x09, 0x0A, 0x0D)
    for (const byte of buffer) {
      //if (byte === 0) return false; // Null byte is a strong indicator of binary
      if (byte < 0x20 && ![0x09, 0x0A, 0x0D].includes(byte)) {
        console.log("File is binary:", filePath, byte);
        return false;
      }
    }

    console.log("File is text:", filePath);
    return true;
  } catch (error) {
    console.error("Error reading file:", error);
    return false;
  }
}

export function readFirstCharacters(filePath: string, sampleSize: number): string {
  try {
    // Open the file
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(sampleSize);
    const bytesRead = fs.readSync(fd, buffer, 0, sampleSize, 0);
    const content = buffer.toString("utf8", 0, bytesRead);

    // Close the file
    fs.closeSync(fd);

    return content;
  } catch (err) {
    console.error("Error reading file:", err.message);
    return "";
  }
}

export function containsMdSupportedExtension(filePath: string): boolean {
  const supportedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp', '.ico', '.tiff', '.csv', '.pdf'];

  const lastDotIndex = filePath.lastIndexOf('.');

  if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
    return false; // No extension found or the file ends with a dot
  }

  const extension = filePath.substring(lastDotIndex).toLowerCase();
  return supportedExtensions.includes(extension);

}

export function isDisplayableMIMEType(mimeType: string): boolean {
  const nonBinaryMimeTypes = [
    "text/plain", "text/html", "text/css", "application/javascript", "text/javascript",
    "application/json", "application/xml", "text/xml", "application/rss+xml",
    "application/atom+xml", "application/xslt+xml", "text/markdown", "text/sgml",
    "text/csv", "text/tab-separated-values", "application/x-yaml", "text/yaml",
    "text/x-python", "text/x-java-source", "application/x-perl", "application/x-ruby",
    "application/x-shellscript", "text/x-log", "text/vcard", "text/calendar"
  ];

  return nonBinaryMimeTypes.includes(mimeType.toLowerCase());
}
import { readdirSync, statSync } from "node:fs";
import { join } from "path";
import untildify from "untildify";
import * as fs from "node:fs";
// @ts-ignore - chrono-node doesn't have type definitions
import * as chrono from "chrono-node";
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

/**
 * Parses a freestyle date/time input and converts it to Zipline API format.
 * Uses chrono-node for natural language parsing and supports:
 * - Relative time: "1h", "2d", "3w", etc. (returns as-is)
 * - ISO format: "2025-12-31T23:59:59Z" or "date=2025-12-31T23:59:59Z" (returns ISO without "date=" prefix)
 * - DD.MM.YYYY or DD-MM-YYYY: "05.01.2026" or "05-01-2026"
 * - MM/DD/YYYY: "01/05/2026"
 * - YYYY-MM-DD: "2026-01-05"
 * - Natural language (via chrono-node): "tomorrow", "next week", "in 3 days", "March 15, 2026", etc.
 *
 * @param input - The date/time input string
 * @returns The formatted string (ISO date without "date=" prefix, or relative time as-is), or null if parsing fails
 */
export function parseDeletionTime(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // If it's relative time format, return as-is
  if (trimmed.match(/^\d+[hdwmy]$/i)) {
    return trimmed;
  }

  // If it's already in ISO format with "date=" prefix, extract the date part
  if (trimmed.startsWith("date=")) {
    const isoDate = trimmed.substring(5); // Remove "date=" prefix
    // Validate it's a valid ISO date
    const date = new Date(isoDate);
    if (!isNaN(date.getTime())) {
      return isoDate;
    }
  }

  // If it's already a valid ISO date string (without prefix), return as-is
  if (trimmed.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return trimmed;
    }
  }

  // Try chrono-node for natural language and various date formats
  const now = new Date();
  const chronoResult = chrono.parseDate(trimmed, now);
  
  let date: Date | null = null;
  
  if (chronoResult && !isNaN(chronoResult.getTime())) {
    date = chronoResult;
    // If no time is specified, set to end of day (23:59:59)
    if (date && !trimmed.match(/\d{1,2}:\d{2}/)) {
      date.setHours(23, 59, 59, 999);
    }
  } else {
    // Fallback to manual parsing for specific formats that chrono might not handle well
    // DD.MM.YYYY or DD-MM-YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1; // Month is 0-indexed
      const year = parseInt(ddmmyyyy[3], 10);
      const hour = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 23;
      const minute = ddmmyyyy[5] ? parseInt(ddmmyyyy[5], 10) : 59;
      const second = ddmmyyyy[6] ? parseInt(ddmmyyyy[6], 10) : 59;
      date = new Date(year, month, day, hour, minute, second);
    } else {
      // MM/DD/YYYY
      const mmddyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
      if (mmddyyyy) {
        const month = parseInt(mmddyyyy[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(mmddyyyy[2], 10);
        const year = parseInt(mmddyyyy[3], 10);
        const hour = mmddyyyy[4] ? parseInt(mmddyyyy[4], 10) : 23;
        const minute = mmddyyyy[5] ? parseInt(mmddyyyy[5], 10) : 59;
        const second = mmddyyyy[6] ? parseInt(mmddyyyy[6], 10) : 59;
        date = new Date(year, month, day, hour, minute, second);
      } else {
        // YYYY-MM-DD
        const yyyymmdd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
        if (yyyymmdd) {
          const year = parseInt(yyyymmdd[1], 10);
          const month = parseInt(yyyymmdd[2], 10) - 1; // Month is 0-indexed
          const day = parseInt(yyyymmdd[3], 10);
          const hour = yyyymmdd[4] ? parseInt(yyyymmdd[4], 10) : 23;
          const minute = yyyymmdd[5] ? parseInt(yyyymmdd[5], 10) : 59;
          const second = yyyymmdd[6] ? parseInt(yyyymmdd[6], 10) : 59;
          date = new Date(year, month, day, hour, minute, second);
        }
      }
    }
  }

  // If we successfully parsed a date, format it for Zipline (without "date=" prefix)
  if (date && !isNaN(date.getTime())) {
    // Ensure the date is in the future
    if (date.getTime() <= now.getTime()) {
      return null; // Date is in the past
    }
    return date.toISOString();
  }

  // If we couldn't parse it, return null (validation will catch this)
  return null;
}
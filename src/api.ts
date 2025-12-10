import axios from "axios";
import { open, showToast, Toast, Clipboard } from "@raycast/api";
import { getExtensionPreferences } from "./preferences";
import FormData from "form-data";
import fs from "node:fs";
import { Readable } from "node:stream";

export interface UploadOptions {
  deletesAt?: string;
  password?: string;
  maxViews?: number;
  folder?: string;
}

export interface UploadResult {
  url: string;
  id: string;
  type: string;
}

export async function uploadContent(
  content: { textContent: string } | { filePath: string; forceImage: boolean },
  options?: UploadOptions,
): Promise<UploadResult> {
  const formData = new FormData();

  if ("textContent" in content) {
    formData.append("file", Readable.from(content.textContent), "text.txt");
  } else if ("filePath" in content) {
    const filename = content.forceImage ? "image.png" : undefined;
    formData.append("file", fs.createReadStream(content.filePath), filename);
  } else {
    throw new Error("Invalid content provided. Must include textContent or filePath.");
  }

  const preferences = getExtensionPreferences();

  // Build headers for Zipline v4 API
  const headers: Record<string, string> = {
    Authorization: preferences.ziplineApiToken,
    ...formData.getHeaders(),
  };

  // Add optional upload headers
  if (options?.deletesAt) {
    headers["x-zipline-deletes-at"] = options.deletesAt;
  }
  if (options?.password) {
    headers["x-zipline-password"] = options.password;
  }
  if (options?.maxViews) {
    headers["x-zipline-max-views"] = options.maxViews.toString();
  }
  if (options?.folder) {
    headers["x-zipline-folder"] = options.folder;
  }

  const response = await axios.post(`${preferences.ziplineBaseUrl}/api/upload`, formData, {
    headers,
  });

  if (response.status === 200) {
    // Zipline v4 returns files array with objects containing id, type, and url
    const fileData = response.data.files[0] as { id: string; type: string; url: string };
    const uploadUrl = fileData.url;

    if (preferences.copyLinkToClipboardAfterUpload) {
      await Clipboard.copy(uploadUrl);
    }

    if (preferences.openBrowserAfterUpload) {
      await open(uploadUrl);
    }

    let toastText = "Upload successful!";
    if (preferences.copyLinkToClipboardAfterUpload) {
      toastText += " Link copied to clipboard.";
    }

    await showToast(Toast.Style.Success, toastText);

    return {
      url: uploadUrl,
      id: fileData.id,
      type: fileData.type,
    };
  } else {
    await showToast(Toast.Style.Failure, "Upload failed", response.statusText);
    throw new Error(`Upload failed: ${response.statusText}`);
  }
}

export interface ShortenUrlOptions {
  vanity?: string;
  password?: string;
  maxViews?: number;
}

export interface ShortenUrlResult {
  url: string;
  code: string;
  destination: string;
}

export async function shortenUrl(destination: string, options?: ShortenUrlOptions): Promise<ShortenUrlResult> {
  const preferences = getExtensionPreferences();

  const headers: Record<string, string> = {
    Authorization: preferences.ziplineApiToken,
    "Content-Type": "application/json",
  };

  if (options?.password) {
    headers["x-zipline-password"] = options.password;
  }
  if (options?.maxViews) {
    headers["x-zipline-max-views"] = options.maxViews.toString();
  }

  const body: { destination: string; vanity?: string } = { destination };
  if (options?.vanity) {
    body.vanity = options.vanity;
  }

  const response = await axios.post(`${preferences.ziplineBaseUrl}/api/user/urls`, body, {
    headers,
  });

  if (response.status === 200) {
    const shortUrl = response.data.url as string;

    if (preferences.copyLinkToClipboardAfterUpload) {
      await Clipboard.copy(shortUrl);
    }

    if (preferences.openBrowserAfterUpload) {
      await open(shortUrl);
    }

    let toastText = "URL shortened successfully!";
    if (preferences.copyLinkToClipboardAfterUpload) {
      toastText += " Link copied to clipboard.";
    }

    await showToast(Toast.Style.Success, toastText);

    return {
      url: shortUrl,
      code: response.data.code,
      destination: response.data.destination,
    };
  } else {
    await showToast(Toast.Style.Failure, "URL shortening failed", response.statusText);
    throw new Error(`URL shortening failed: ${response.statusText}`);
  }
}

export async function getPage(pageNumber: number = 1, pageSize: number): Promise<FileResponse> {
  const preferences = getExtensionPreferences();
  const response = await axios.get<FileResponse>(
    `${preferences.ziplineBaseUrl}/api/user/files?page=${pageNumber}&perpage=${pageSize}`,
    {
      headers: {
        Authorization: preferences.ziplineApiToken,
      },
    },
  );

  if (response.status != 200) {
    console.log("url", `${preferences.ziplineBaseUrl}/api/user/files?page=${pageNumber}`);
    console.log("Failed to fetch page", response.statusText);
  }

  return response.data;
}

export async function getUrls(): Promise<UrlInfo[]> {
  const preferences = getExtensionPreferences();
  const response = await axios.get<UrlInfo[]>(`${preferences.ziplineBaseUrl}/api/user/urls`, {
    headers: {
      Authorization: preferences.ziplineApiToken,
    },
  });

  if (response.status != 200) {
    console.log("Failed to fetch URLs", response.statusText);
  }

  return response.data;
}

export async function deleteUrl(id: string): Promise<void> {
  const preferences = getExtensionPreferences();
  await axios.delete(`${preferences.ziplineBaseUrl}/api/user/urls/${id}`, {
    headers: {
      Authorization: preferences.ziplineApiToken,
    },
  });
}

export async function deleteFile(id: string): Promise<void> {
  const preferences = getExtensionPreferences();
  await axios.delete(`${preferences.ziplineBaseUrl}/api/user/files/${id}`, {
    headers: {
      Authorization: preferences.ziplineApiToken,
    },
  });
}

export async function getFileContent(url: string) {
  try {
    const response = await axios.get<string>(url);
    return response.data;
  } catch {
    return "Raw endpoint not supported.";
  }
}

export interface FileResponse {
  page: FileInfo[];
  total: number;
  pages: number;
}

export interface FileInfo {
  createdAt: string;
  updatedAt: string;
  deletesAt: string | null;
  name: string;
  originalName: string | null;
  type: string;
  id: string;
  favorite: boolean;
  views: number;
  maxViews: number | null;
  folderId: string | null;
  size: number;
  password: boolean | null;
  thumbnail: { path: string } | null;
  tags: { id: string; name: string }[];
  url: string;
}

export interface UrlInfo {
  id: string;
  createdAt: string;
  updatedAt: string;
  destination: string;
  code: string;
  vanity: string | null;
  views: number;
  maxViews: number | null;
  enabled: boolean;
}

import axios from "axios";
import { open, showToast, Toast, useNavigation } from "@raycast/api";
import { getExtensionPreferences } from "./preferences";
import FormData from "form-data";
import fs from "node:fs";
import { Readable } from "node:stream";
import exp from "node:constants";

export async function uploadContent(
  content: {textContent: string} | {filePath: string, forceImage: boolean},
) {

  const formData = new FormData();

  // Determine the type of content
  if ("textContent" in content) {
    // Handle text content
    formData.append("file", Readable.from(content.textContent), "text.txt");
  } else if ("filePath" in content) {
    // Handle file upload from disk
    const filename = content.forceImage ? "image.png" : undefined;
    formData.append("file", fs.createReadStream(content.filePath), filename);
  } else {
    throw new Error("Invalid content provided. Must include textContent or filePath.");
  }

  const preferences = getExtensionPreferences();
  const response = await axios.post(`${preferences.ziplineBaseUrl}/api/upload`, formData, {
    headers: {
      "Authorization": preferences.ziplineApiToken,
      ...formData.getHeaders()
    }
  });

  if (response.status === 200) {
    const uploadUrl = response.data.files[0] as string;
    await open(uploadUrl)

    await showToast(Toast.Style.Success, "Upload successful!");
  } else {
    await showToast(Toast.Style.Failure, "Upload failed", response.statusText);
  }

}

export async function getPage(pageNumber: number = 1): Promise<FileInfo[]> {
  const preferences = getExtensionPreferences();
  const response = await axios.get<FileInfo[]>(`${preferences.ziplineBaseUrl}/api/user/paged?page=${pageNumber}`, {
    headers: {
      "Authorization": preferences.ziplineApiToken,
    }
  });

  return response.data;
}

export async function getFileContent(url: string) {
  const response = await axios.get<string>(url);
  return response.data;
}


export interface FileInfo {
  createdAt: string; // ISO string for creation date
  expiresAt: string | null; // ISO string for expiration or null if none
  name: string; // Name of the file
  mimetype: string; // MIME type of the file
  id: number; // Unique identifier for the file
  favorite: boolean; // Whether the file is marked as favorite
  views: number; // Number of views the file has
  maxViews: number | null; // Maximum allowed views or null if unlimited
  folderId: number | null; // ID of the folder the file belongs to or null
  size: number; // Size of the file in bytes
  password: string | null; // Password for the file or null if none
  thumbnail: string | null; // URL to the file's thumbnail or null
  url: string; // Relative or absolute URL to access the file
}
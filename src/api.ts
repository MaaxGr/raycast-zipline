import axios from "axios";
import { open, showToast, Toast } from "@raycast/api";
import { getExtensionPreferences } from "./preferences";
import FormData from "form-data";
import fs from "node:fs";

export async function uploadFile(filePath: string, forceImage: boolean = false) {
  const formData = new FormData();

  if (forceImage) {
    formData.append("file", fs.createReadStream(filePath), "image.png");
  } else  {
    formData.append("file", fs.createReadStream(filePath));
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
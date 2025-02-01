import { getPreferenceValues } from "@raycast/api";

export interface Preferences {
  ziplineBaseUrl: string;
  ziplineApiToken: string;
  defaultFileLocation: string;
  openBrowserAfterUpload: boolean;
  copyLinkToClipboardAfterUpload: boolean;
}

export function getExtensionPreferences(): Preferences {
  return getPreferenceValues<Preferences>();
}
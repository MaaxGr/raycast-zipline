import { getPreferenceValues } from "@raycast/api";

export interface Preferences {
  ziplineBaseUrl: string;
  ziplineApiToken: string;
}

export function getExtensionPreferences(): Preferences {
  return getPreferenceValues<Preferences>();
}
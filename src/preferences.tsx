import { getPreferenceValues } from "@raycast/api";

export interface Preferences {
  ziplineBaseUrl: string;
  ziplineApiToken: string;
  defaultFileLocation: string;
  openBrowserAfterUpload: boolean;
  copyLinkToClipboardAfterUpload: boolean;
}

export interface CommandPreferences {
  dateParsingLocale_en?: boolean;
  dateParsingLocale_de?: boolean;
  dateParsingLocale_fr?: boolean;
  dateParsingLocale_nl?: boolean;
  dateParsingLocale_ru?: boolean;
  dateParsingLocale_ja?: boolean;
  dateParsingLocale_uk?: boolean;
}

export function getExtensionPreferences(): Preferences {
  return getPreferenceValues<Preferences>();
}

export function getCommandPreferences(): CommandPreferences {
  return getPreferenceValues<CommandPreferences>();
}

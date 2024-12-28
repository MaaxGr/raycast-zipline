import { readdirSync, statSync } from "node:fs";
import { join } from "path";
import untildify from "untildify";
import * as fs from "node:fs";

//const preferences: Preferences = getPreferenceValues();
export const downloadsFolder = untildify("~/Desktop");

export function getScreenshots() {
  console.log("Getting screenshots from", downloadsFolder, "with force refresh");
  // Clear require cache if necessary (e.g., for dynamic imports)
  fs.closeSync(fs.openSync(downloadsFolder, "r")); // Access the directory to force a refresh

  const files = readdirSync(downloadsFolder);
  return files
    .filter((file) => !file.startsWith("."))
    .map((file) => {
      const path = join(downloadsFolder, file);
      const lastModifiedAt = statSync(path).mtime;
      return { file, path, lastModifiedAt };
    })
    .sort((a, b) => b.lastModifiedAt.getTime() - a.lastModifiedAt.getTime());
}
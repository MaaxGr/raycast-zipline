import { ActionPanel, Action, List, showToast, Toast, open } from "@raycast/api";
import { useState } from "react";
import { downloadsFolder, getScreenshots } from "./utils";
import * as fs from "node:fs";
import axios from "axios";
import FormData from "form-data";
import { getExtensionPreferences } from "./preferences";


export default function Command() {
  const [screenshots] = useState(getScreenshots());
  const preferences = getExtensionPreferences();

  const handleSubmit = async (screenshot: any) => {
    try {
      await showToast(Toast.Style.Animated, "Uploading...");

      const formData = new FormData();
      formData.append("file", fs.createReadStream(screenshot.path));

      const response = await axios.post(`${preferences.ziplineBaseUrl}/api/upload`, formData, {
        headers: {
          "Authorization": preferences.ziplineApiToken,
          ...formData.getHeaders()
        }
      });

      if (response.status === 200) {
        let uploadUrl = response.data.files[0] as string;
        await open(response.data.files[0] as string);

        await showToast(Toast.Style.Success, "Upload successful!");
      } else {
        await showToast(Toast.Style.Failure, "Upload failed", response.statusText);
      }
    } catch (error: any) {
      console.error(error.message);
      await showToast(Toast.Style.Failure, "Error", error.message);
    }
  };

  return (
    <List>
      {screenshots.length === 0 && (
        <List.EmptyView icon={{ fileIcon: downloadsFolder }} title="No screenshots found" description="¯\_(ツ)_/¯" />
      )}

      {screenshots.map((screenshot) => (
        <List.Item
          key={screenshot.path}
          title={screenshot.file}
          icon={{ fileIcon: screenshot.path }}
          quickLook={{ path: screenshot.path, name: screenshot.file }}
          accessories={[
            {
              date: screenshot.lastModifiedAt,
              tooltip: `Last modified: ${screenshot.lastModifiedAt.toLocaleString()}`,
            },
          ]}
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action
                  title="Upload File"
                  onAction={() => handleSubmit(screenshot)}
                />
                <Action.Open title="Open File" target={screenshot.path} />
                <Action.ShowInFinder path={screenshot.path} />
                <Action.CopyToClipboard
                  title="Copy File"
                  content={{ file: screenshot.path }}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action.OpenWith path={screenshot.path} shortcut={{ modifiers: ["cmd"], key: "o" }} />
                <Action.ToggleQuickLook shortcut={{ modifiers: ["cmd"], key: "y" }} />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action.Trash
                  title="Delete Download"
                  paths={screenshot.path}
                  shortcut={{ modifiers: ["ctrl"], key: "x" }}
                />
                <Action.Trash
                  title="Delete All Downloads"
                  paths={screenshots.map((d) => d.path)}
                  shortcut={{ modifiers: ["ctrl", "shift"], key: "x" }}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

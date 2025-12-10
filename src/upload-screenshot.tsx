import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";
import { useState } from "react";
import {
  containsMdSupportedExtension,
  createMarkdownImage,
  downloadsFolder,
  getScreenshots,
  readFirstCharacters,
} from "./utils";
import { isBinaryFileSync } from "isbinaryfile";
import { uploadContent } from "./api";

interface Screenshot {
  file: string;
  path: string;
  lastModifiedAt: Date;
}

export default function Command() {
  const [screenshots] = useState<Screenshot[]>(getScreenshots());

  const handleSubmit = async (screenshot: Screenshot) => {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Uploading..." });
      await uploadContent({ filePath: screenshot.path, forceImage: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Upload failed", message: errorMessage });
    }
  };

  return (
    <List isShowingDetail>
      {screenshots.length === 0 && (
        <List.EmptyView icon={{ fileIcon: downloadsFolder }} title="No screenshots found" description="¯\_(ツ)_/¯" />
      )}

      {screenshots.map((screenshot) => {
        const path = screenshot.path;

        let markdown;
        if (containsMdSupportedExtension(path)) {
          markdown = createMarkdownImage(encodeURI(path));
        } else if (!isBinaryFileSync(path)) {
          markdown = readFirstCharacters(path, 10_000);
        } else {
          markdown = `## Can't display binary file`;
        }

        return (
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
            detail={<List.Item.Detail markdown={markdown || "Can't load preview..."} />}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action title="Upload File" onAction={() => handleSubmit(screenshot)} />
                  <Action.Open title="Open File" target={screenshot.path} />
                  <Action.ToggleQuickLook shortcut={{ modifiers: ["cmd"], key: "v" }} />

                  <Action.ShowInFinder path={screenshot.path} />
                  <Action.CopyToClipboard
                    title="Copy File"
                    content={{ file: screenshot.path }}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action.OpenWith path={screenshot.path} shortcut={{ modifiers: ["cmd"], key: "o" }} />
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
        );
      })}
    </List>
  );
}

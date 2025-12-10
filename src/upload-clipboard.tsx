import { Action, ActionPanel, Clipboard, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { containsMdSupportedExtension, downloadsFolder, readFirstCharacters } from "./utils";
import { isBinaryFileSync } from "isbinaryfile";
import { uploadContent } from "./api";

export default function Command() {
  const [clipboard, setClipboard] = useState<Clipboard.ReadContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadClipboardContent() {
      try {
        const initialItems: Clipboard.ReadContent[] = (
          await Promise.all(
            Array.from({ length: 6 }, (_, i) => i).map(async (index) => {
              return await Clipboard.read({ offset: index });
            }),
          )
        ).filter((item) => item.text !== undefined);
        setClipboard(initialItems);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await showToast({ style: Toast.Style.Failure, title: "Failed to read clipboard", message: errorMessage });
      } finally {
        setIsLoading(false);
      }
    }

    loadClipboardContent();
  }, []);

  const navigation = useNavigation();

  const handleUpload = async (clipboardItem: Clipboard.ReadContent) => {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Uploading..." });

      if (clipboardItem.file != undefined) {
        const path = decodeURI(clipboardItem.file?.replace("file://", ""));
        const isImageFromClipboard = path.startsWith("/var") && clipboardItem.text.includes("Image (");
        await uploadContent({ filePath: path, forceImage: isImageFromClipboard });
      } else {
        await uploadContent({ textContent: clipboardItem.text });
      }

      navigation.pop();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Upload failed", message: errorMessage });
    }
  };

  return (
    <List isShowingDetail isLoading={isLoading}>
      {clipboard.length === 0 && !isLoading && (
        <List.EmptyView
          icon={{ fileIcon: downloadsFolder }}
          title="No clipboard content"
          description="Copy something to your clipboard first"
        />
      )}

      {clipboard.map((clipboardItem, index) => {
        let markdown = "";
        const path = clipboardItem.file?.replace("file://", "");

        if (path != null) {
          if (containsMdSupportedExtension(path) || path.startsWith("/var")) {
            markdown = `![Image Preview](${path})`;
          } else if (!isBinaryFileSync(path)) {
            markdown = readFirstCharacters(path, 10_000);
          } else {
            markdown = `## Can't display binary file`;
          }
        } else {
          markdown = "```\n" + clipboardItem.text + "\n```";
        }

        let icon: Icon | { fileIcon: string } = Icon.Document;
        if (clipboardItem.file != null) {
          icon = { fileIcon: clipboardItem.file };
        }

        return (
          <List.Item
            key={`${index}-${clipboardItem.file ?? clipboardItem.text}`}
            title={clipboardItem.text}
            icon={icon}
            detail={<List.Item.Detail markdown={markdown} />}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action title="Upload File" onAction={() => handleUpload(clipboardItem)} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

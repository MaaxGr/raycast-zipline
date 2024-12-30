import { Action, ActionPanel, Clipboard, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { containsMdSupportedExtension, downloadsFolder, readFirstCharacters } from "./utils";
import { getExtensionPreferences } from "./preferences";
import { isBinaryFileSync } from "isbinaryfile";
import { uploadContent } from "./api";

export default function Command() {
  const [clipboard, setClipboard] = useState<Clipboard.ReadContent[]>([]); // State to hold loaded data
  const preferences = getExtensionPreferences();

  useEffect(() => {
    async function loadClipboardContent() {
      const initialItems: Clipboard.ReadContent[] = (
        await Promise.all(
          [0, 1, 2, 3, 4, 5].map(async (index) => {
            return await Clipboard.read({ offset: index });
          }),
        )
      ).filter((item) => item.text !== undefined);
      setClipboard(initialItems);
    }

    loadClipboardContent(); // Call the async function
  }, []);

  const navigation = useNavigation();

  const handleUpload = async (clipboardItem: Clipboard.ReadContent) => {
    try {
      await showToast(Toast.Style.Animated, "Uploading...");

      if (clipboardItem.file != undefined) {
        const path = decodeURI(clipboardItem.file?.replace("file://", ""));
        const isImageFromClipboard = path.startsWith("/var") && clipboardItem.text.includes("Image (");
        await uploadContent({ filePath: path, forceImage: isImageFromClipboard });
      } else {
        await uploadContent({ textContent: clipboardItem.text });
      }

      navigation.pop();
    } catch (error: any) {
      console.error(error.message);
      await showToast(Toast.Style.Failure, "Error", error.message);
    }
  };

  return (
    <List isShowingDetail>
      {clipboard.length === 0 && (
        <List.EmptyView icon={{ fileIcon: downloadsFolder }} title="No screenshots found" description="¯\_(ツ)_/¯" />
      )}

      {clipboard.map((clipboardItem) => {
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

        let icon: any = Icon.Document;
        if (clipboardItem.file != null) {
          icon = { fileIcon: clipboardItem.file };
        }

        return (
          <List.Item
            key={clipboardItem.text}
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

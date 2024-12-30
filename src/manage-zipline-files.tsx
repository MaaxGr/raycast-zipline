import { Action, ActionPanel, Clipboard, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { containsMdSupportedExtension, downloadsFolder, isDisplayableMIMEType, readFirstCharacters } from "./utils";
import { getExtensionPreferences } from "./preferences";
import { isBinaryFileSync } from "isbinaryfile";
import { FileInfo, getFileContent, getPage, uploadContent } from "./api";
import { it } from "node:test";

export interface RichFileInfo {
  fileInfo: FileInfo;
  fileContent: string|null;
}

export default function Command() {
  const [items, setItems] = useState<RichFileInfo[]>([]); // State to hold loaded data
  const preferences = getExtensionPreferences();
  const navigation = useNavigation();

  useEffect(() => {
    async function init() {
      const data = await getPage()

      const richData = await Promise.all(
        data.map(async (fileInfo) => {
          let fileContent: string | null = null;

          // Fetch file content if the MIME type is displayable
          if (isDisplayableMIMEType(fileInfo.mimetype)) {
            fileContent = await getFileContent(`${preferences.ziplineBaseUrl}${fileInfo.url}`);
          }

          // Return enriched file info
          return {
            fileInfo,
            fileContent,
          };
        })
      );

      setItems(richData);
    }

    init();
  }, []);


  return (
    <List isShowingDetail>
      {items.length === 0 && (
        <List.EmptyView icon={{ fileIcon: downloadsFolder }} title="No screenshots found" description="¯\_(ツ)_/¯" />
      )}

      {items.map((item) => {

        const fullUrl = `${preferences.ziplineBaseUrl}${item.fileInfo.url}`;

        let markdown = "";

        if (item.fileContent != null) {
          markdown = "```" + item.fileContent + "```";
        } else  {
          markdown = `![Image Preview](${fullUrl})`;
        }



        return (
          <List.Item
            key={item.fileInfo.name}
            title={item.fileInfo.name}
            detail={<List.Item.Detail markdown={markdown} />}

          />
        );
      })}
    </List>
  );
}

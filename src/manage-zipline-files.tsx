import { Icon, List, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { createMarkdownImage, downloadsFolder, isDisplayableMIMEType } from "./utils";
import { getExtensionPreferences } from "./preferences";
import { FileInfo, getFileContent, getPage } from "./api";

export interface RichFileInfo {
  fileInfo: FileInfo;
  fileContent: string | null;
}

export default function Command() {
  const [items, setItems] = useState<RichFileInfo[]>([]); // State to hold loaded data
  const preferences = getExtensionPreferences();
  const navigation = useNavigation();

  useEffect(() => {
    async function init() {
      const data1 = await getPage(1, true);
      const data2 = await getPage(1, false);
      const data = data1.concat(data2).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

      const richData = await Promise.all(
        data.map(async (fileInfo) => {
          let fileContent: string | null = null;

          // Fetch file content if the MIME type is displayable
          if (isDisplayableMIMEType(fileInfo.mimetype)) {
            let url = `${preferences.ziplineBaseUrl}${fileInfo.url}`.replace("/u/", "/raw/");

            if (fileInfo.password == true) {
              fileContent = "Password protected files are not supported";
            } else {
              fileContent = await getFileContent(url);
            }
          }

          // Return enriched file info
          return {
            fileInfo,
            fileContent,
          };
        }),
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
          if (item.fileInfo.name.endsWith(".md")) {
            markdown = item.fileContent;
          } else {
            markdown = "```" + item.fileContent + "```";
          }
        } else {
          markdown = createMarkdownImage(fullUrl);
        }

        const date = new Date(item.fileInfo.createdAt);
        const favoriteIcon = item.fileInfo.favorite ? Icon.Star : null;
        const expiresString = item.fileInfo.expiresAt
        let expiryAccessory = {}
        if (expiresString != null) {
          const expiryDate = new Date(expiresString)
          expiryAccessory = {
            icon: Icon.Clock,
            tooltip: `Expires at: ${expiryDate.toLocaleString()}`,
          }
        }

        return (
          <List.Item
            key={item.fileInfo.name}
            title={item.fileInfo.name}
            detail={<List.Item.Detail markdown={markdown} />}
            accessories={[
              expiryAccessory,
              {
                icon: favoriteIcon,
              },
              {
                date: date,
                tooltip: `Uploaded at: ${date.toLocaleString()}`,
              },
            ]}
          />
        );
      })}
    </List>
  );
}

import { Action, ActionPanel, Clipboard, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { containsMdSupportedExtension, downloadsFolder, readFirstCharacters } from "./utils";
import { getExtensionPreferences } from "./preferences";
import { isBinaryFileSync } from "isbinaryfile";
import { FileInfo, getPage, uploadContent } from "./api";

export default function Command() {
  const [items, setItems] = useState<FileInfo[]>([]); // State to hold loaded data
  const preferences = getExtensionPreferences();
  const navigation = useNavigation();

  useEffect(() => {
    async function init() {
      const data = await getPage()
      setItems(data);
    }

    init();
  }, []);


  return (
    <List isShowingDetail>
      {items.length === 0 && (
        <List.EmptyView icon={{ fileIcon: downloadsFolder }} title="No screenshots found" description="¯\_(ツ)_/¯" />
      )}

      {items.map((item) => {

        let fullUrl = `${preferences.ziplineBaseUrl}${item.url}`
        let markdown = `![Image Preview](${fullUrl})`;


        return (
          <List.Item
            key={item.name}
            title={item.name}
            detail={<List.Item.Detail markdown={markdown} />}

          />
        );
      })}
    </List>
  );
}

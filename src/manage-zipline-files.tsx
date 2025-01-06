import { Icon, List, useNavigation } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { createMarkdownImage, downloadsFolder, isDisplayableMIMEType } from "./utils";
import { getExtensionPreferences } from "./preferences";
import { FileInfo, getFileContent, getPage } from "./api";
import { usePromise } from "@raycast/utils";

export interface RichFileInfo {
  fileInfo: FileInfo;
  fileContent: string | null;
}

type State = {
  searchText: string;
  isLoading: boolean;
  hasMore: boolean;
  data: RichFileInfo[];
  nextPage: number;
};

const pageSize = 16;

export default function Command() {
  //const [items, setItems] = useState<RichFileInfo[]>([]); // State to hold loaded data
  const preferences = getExtensionPreferences();
  const navigation = useNavigation();

  const [state, setState] = useState<State>({ searchText: "", isLoading: true, hasMore: true, data: [], nextPage: 0 });
  const cancelRef = useRef<AbortController | null>(null);


/*
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

 */


  const loadNextPage = useCallback(async (searchText: string, nextPage: number, signal?: AbortSignal) => {
    setState((previous) => ({ ...previous, isLoading: true }));

    const data1 = await getPage(1, true);
    const data2 = await getPage(1, false);
    const newData = data1.concat(data2).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const richData = await Promise.all(
      newData.map(async (fileInfo) => {
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

    if (signal?.aborted) {
      return;
    }
    setState((previous) => ({
      ...previous,
      data: [...previous.data, ...richData],
      isLoading: false,
      hasMore: nextPage < 10,
    }));
  }, []);

  useEffect(() => {
    cancelRef.current?.abort();
    cancelRef.current = new AbortController();
    loadNextPage(state.searchText, state.nextPage, cancelRef.current?.signal);
    return () => {
      cancelRef.current?.abort();
    };
  }, [loadNextPage, state.searchText, state.nextPage]);

  const onLoadMore = useCallback(() => {
    setState((previous) => ({ ...previous, nextPage: previous.nextPage + 1 }));
  }, []);


  return (
    <List isShowingDetail
          isLoading={state.isLoading}
          pagination={{ onLoadMore, hasMore: state.hasMore, pageSize }}>
      {state.data.length === 0 && (
        <List.EmptyView icon={{ fileIcon: downloadsFolder }} title="No screenshots found" description="¯\_(ツ)_/¯" />
      )}

      {state.data.map((item) => {
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

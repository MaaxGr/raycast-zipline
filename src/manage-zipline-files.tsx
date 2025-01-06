import { Icon, List } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { createMarkdownImage, downloadsFolder, isDisplayableMIMEType } from "./utils";
import { getExtensionPreferences } from "./preferences";
import { FileInfo, getFileContent, getPage, getPageCount } from "./api";

export interface RichFileInfo {
  fileInfo: FileInfo;
  fileContent: string | null;
}

type State = {
  searchText: string;
  isLoading: boolean;
  hasMore: boolean;
  data: FileInfo[];
  visibleData: RichFileInfo[];
  nextPage: number;
};

const pageSize = 16;




export default function Command() {
  const preferences = getExtensionPreferences();

  const [state, setState] = useState<State>({ searchText: "", isLoading: true, hasMore: true, data: [], nextPage: 1, visibleData: [] });
  const cancelRef = useRef<AbortController | null>(null);
  const fetchedState = useRef(0);

  async function loadAllData(): Promise<FileInfo[]> {
    const favoriteCount = await getPageCount(true);
    const normalCount = await getPageCount(false);

    const items: FileInfo[] = [];
    for (let i = 1; i <= favoriteCount; i++) {
      const data = await getPage(i, true);
      items.push(...data);
    }

    for (let i = 1; i <= normalCount; i++) {
      const data = await getPage(i, false);
      items.push(...data);
    }

    console.log("loadAllData", items.length);

    return items;
  }


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
    console.log("loadNextPage", nextPage, state.data.length);
    //setState((previous) => ({ ...previous, isLoading: true }));

    const subsetData = state.data.slice(0, Math.min(nextPage * pageSize, state.data.length))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));


    const subsetRichData = await Promise.all(
      subsetData.map(async (fileInfo) => {
        let fileContent: string | null = null;

        // Fetch file content if the MIME type is displayable
        if (isDisplayableMIMEType(fileInfo.mimetype)) {
          const url = `${preferences.ziplineBaseUrl}${fileInfo.url}`.replace("/u/", "/raw/");

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

    console.log('abort', signal?.aborted)

    if (signal?.aborted) {
      return;
    }

    console.log("loadNextPage subset", subsetRichData.length);

    setState((previous) => ({
      ...previous,
      visibleData: subsetRichData,
      isLoading: false,
      hasMore: nextPage < 10,
    }));
  }, []);

  useEffect(() => {
    if (fetchedState.current > 0) {
      return () => {};
    }
    fetchedState.current = 1;

    const controller = new AbortController();
    cancelRef.current = controller;

    console.log("INITIAL LOAD AAAAAH");

    const fetchData = async () => {
      try {
        const items = await loadAllData()
        setState((previous) => ({ ...previous, data: items }));
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error loading data:", error);
        }
      }
    };

    fetchData();

    return () => controller.abort(); // Cleanup on unmount
  }, []);

  useEffect(() => {
    if (fetchedState.current != 1) {
      return () => {};
    }
    fetchedState.current = 2;

    const fetchData = async () => {
      await loadNextPage(state.searchText, state.nextPage);
      setState((previous) => ({ ...previous }));
    };
    fetchData()
  }, [state.data]);

  useEffect(() => {
    if (fetchedState.current < 2) {
      return () => {};
    }

    console.log("after initialized");

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

      {state.visibleData.map((item) => {
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

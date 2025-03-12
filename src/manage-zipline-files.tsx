import { Icon, List } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { createMarkdownImage, downloadsFolder, isDisplayableMIMEType } from "./utils";
import { getExtensionPreferences } from "./preferences";
import { FileInfo, getFileContent, getPage } from "./api";
import ListItemAccessory = List.Item.Accessory;

export interface RichFileInfo {
  fileInfo: FileInfo;
  fileContent: string | null;
}

type State = {
  initial: boolean;
  isLoading: boolean;
  data: RichFileInfo[];
  currentPage: number;
  totalPages: number;
  wantsPage: number;
  hasMore: boolean;
};

const pageSize = 15;

export default function Command() {
  const [state, setState] = useState<State>({ initial: true, isLoading: true, data: [], currentPage: 0, totalPages: 0, wantsPage: 1, hasMore: false });

  useEffect(() => {
    async function loadMore() {
      setState((previous) => ({ ...previous, isLoading: true }));
      const pageInfo = await getPageRich(state.wantsPage, pageSize);
      setState((previous) => {
        return {
          ...previous,
          data: state.wantsPage == 1 ? pageInfo.items : [...previous.data, ...pageInfo.items],
          isLoading: false,
          currentPage: state.wantsPage,
          totalPages: pageInfo.pages,
          hasMore: state.wantsPage < pageInfo.pages,
        }
      });
    }

    loadMore();
  }, [state.wantsPage]);

  const onLoadMore = useCallback(() => {
    setState((previous) => {
      return ({ ...previous, wantsPage: previous.wantsPage + 1, hasMore: false })
    });
  }, []);

  return (
    <List isShowingDetail
          isLoading={state.isLoading}
          pagination={{ onLoadMore, hasMore: state.hasMore, pageSize }}>
      {state.data.length === 0 && (
        <List.EmptyView icon={{ fileIcon: downloadsFolder }} title="No files found" description="¯\_(ツ)_/¯" />
      )}
      {state.data.map((item) => {
        return (
          <List.Item
            key={item.fileInfo.name}
            title={item.fileInfo.name}
            detail={<List.Item.Detail markdown={getMarkdownContent(item)} />}
            accessories={buildAccessories(item)}
          />
        );
      })}
    </List>
  );
}

async function getPageRich(page: number, pageSize: number) {
  const preferences = getExtensionPreferences();
  const data = await getPage(page, pageSize);
  const items = data.page;

  return {
    pages: data.pages,
    items: await Promise.all(
      items.map(async (fileInfo) => {
        let fileContent: string | null = null;

        if (isDisplayableMIMEType(fileInfo.type)) {
          const url = `${preferences.ziplineBaseUrl}${fileInfo.url}`.replace("/u/", "/raw/");

          if (fileInfo.password == true) {
            fileContent = "Password protected files are not supported";
          } else {
            fileContent = await getFileContent(url);
          }
        }

        return {
          fileInfo,
          fileContent,
        };
      }),
    ),
  }
}

function getMarkdownContent(item: RichFileInfo) {
  const preferences = getExtensionPreferences();
  const fullUrl = `${preferences.ziplineBaseUrl}${item.fileInfo.url}`;

  if (item.fileContent != null) {
    if (item.fileInfo.name.endsWith(".md")) {
      return  item.fileContent;
    } else {
      return  "```" + item.fileContent + "```";
    }
  } else {
    return createMarkdownImage(fullUrl);
  }
}

function buildAccessories(item: RichFileInfo): ListItemAccessory[] {
  const date = new Date(item.fileInfo.createdAt);
  const accessories: ListItemAccessory[] = [
    {
      icon: item.fileInfo.favorite ? Icon.Star : null,
    },
    {
      date: date,
      tooltip: `Uploaded at: ${date.toLocaleString()}`,
    }
  ]

  const expiresString = item.fileInfo.expiresAt
  if (expiresString != null) {
    const expiryDate = new Date(expiresString)

    accessories.unshift({
      icon: Icon.Clock,
      tooltip: `Expires at: ${expiryDate.toLocaleString()}`,
    })
  }

  return accessories;
}

import { Action, ActionPanel, Icon, List, showToast, Toast, confirmAlert, Alert } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { createMarkdownImage, isDisplayableMIMEType } from "./utils";
import { getExtensionPreferences } from "./preferences";
import { FileInfo, getFileContent, getPage, deleteFile } from "./api";
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
  const [state, setState] = useState<State>({
    initial: true,
    isLoading: true,
    data: [],
    currentPage: 0,
    totalPages: 0,
    wantsPage: 1,
    hasMore: false,
  });
  const preferences = getExtensionPreferences();

  const loadData = useCallback(
    async (resetPage = false) => {
      const targetPage = resetPage ? 1 : state.wantsPage;
      setState((previous) => ({ ...previous, isLoading: true, wantsPage: targetPage }));
      const pageInfo = await getPageRich(targetPage, pageSize);
      setState((previous) => {
        return {
          ...previous,
          data: targetPage == 1 ? pageInfo.items : [...previous.data, ...pageInfo.items],
          isLoading: false,
          currentPage: targetPage,
          totalPages: pageInfo.pages,
          hasMore: targetPage < pageInfo.pages,
        };
      });
    },
    [state.wantsPage],
  );

  useEffect(() => {
    loadData();
  }, [state.wantsPage]);

  const onLoadMore = useCallback(() => {
    setState((previous) => {
      return { ...previous, wantsPage: previous.wantsPage + 1, hasMore: false };
    });
  }, []);

  const handleDelete = async (item: RichFileInfo) => {
    if (
      await confirmAlert({
        title: "Delete File",
        message: `Are you sure you want to delete "${item.fileInfo.name}"?`,
        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
      })
    ) {
      try {
        await deleteFile(item.fileInfo.id);
        await showToast({ style: Toast.Style.Success, title: "File deleted" });
        await loadData(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Please try again";
        await showToast({ style: Toast.Style.Failure, title: "Failed to delete file", message: errorMessage });
      }
    }
  };

  return (
    <List isShowingDetail isLoading={state.isLoading} pagination={{ onLoadMore, hasMore: state.hasMore, pageSize }}>
      {state.data.length === 0 && !state.isLoading && (
        <List.EmptyView icon={Icon.Document} title="No files found" description="Upload some files first" />
      )}
      {state.data.map((item) => {
        const fullUrl = `${preferences.ziplineBaseUrl}${item.fileInfo.url}`;

        return (
          <List.Item
            key={item.fileInfo.id}
            title={item.fileInfo.name}
            subtitle={item.fileInfo.originalName || undefined}
            icon={Icon.Document}
            detail={<List.Item.Detail markdown={getMarkdownContent(item)} />}
            accessories={buildAccessories(item)}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy URL" content={fullUrl} />
                  <Action.OpenInBrowser title="Open in Browser" url={fullUrl} />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action
                    title="Refresh"
                    icon={Icon.ArrowClockwise}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={() => loadData(true)}
                  />
                  <Action
                    title="Delete File"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={() => handleDelete(item)}
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
  };
}

function getMarkdownContent(item: RichFileInfo) {
  const preferences = getExtensionPreferences();
  const fullUrl = `${preferences.ziplineBaseUrl}${item.fileInfo.url}`;

  if (item.fileContent != null) {
    if (item.fileInfo.name.endsWith(".md")) {
      return item.fileContent;
    } else {
      return "```" + item.fileContent + "```";
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
      icon: Icon.Eye,
      text: item.fileInfo.views.toString(),
      tooltip: `${item.fileInfo.views} views`,
    },
    {
      date: date,
      tooltip: `Uploaded at: ${date.toLocaleString()}`,
    },
  ];

  // Use deletesAt instead of expiresAt for v4 API
  const deletesAtString = item.fileInfo.deletesAt;
  if (deletesAtString != null) {
    const expiryDate = new Date(deletesAtString);

    accessories.unshift({
      icon: Icon.Clock,
      tooltip: `Deletes at: ${expiryDate.toLocaleString()}`,
    });
  }

  return accessories;
}

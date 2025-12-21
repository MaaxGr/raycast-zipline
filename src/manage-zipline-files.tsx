import { Action, ActionPanel, Icon, List, showToast, Toast, confirmAlert, Alert, Detail, Color } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { createMarkdownImage, isDisplayableMIMEType } from "./utils";
import { getExtensionPreferences } from "./preferences";
import { FileInfo, getFileContent, getPage, deleteFile, toggleFileFavorite, getFolders, FolderInfo } from "./api";
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
  folders: Map<string, string>;
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
    folders: new Map(),
  });
  const preferences = getExtensionPreferences();

  useEffect(() => {
    async function loadFolders() {
      const folders = await getFolders();
      const folderMap = new Map<string, string>();
      folders.forEach((folder) => {
        folderMap.set(folder.id, folder.name);
      });
      setState((previous) => ({ ...previous, folders: folderMap }));
    }
    loadFolders();
  }, []);

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

  const handleToggleFavorite = async (item: RichFileInfo) => {
    try {
      const newFavoriteStatus = !item.fileInfo.favorite;
      await toggleFileFavorite(item.fileInfo.id, newFavoriteStatus);
      await showToast({
        style: Toast.Style.Success,
        title: newFavoriteStatus ? "File favorited" : "File unfavorited",
      });
      await loadData(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      await showToast({ style: Toast.Style.Failure, title: "Failed to toggle favorite", message: errorMessage });
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
            detail={<List.Item.Detail markdown={getMarkdownContent(item)} metadata={buildMetadata(item, fullUrl, state.folders)} />}
            accessories={buildAccessories(item)}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy URL" content={fullUrl} />
                  <Action.OpenInBrowser title="Open in Browser" url={fullUrl} />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action
                    title={item.fileInfo.favorite ? "Unfavorite" : "Favorite"}
                    icon={item.fileInfo.favorite ? Icon.StarDisabled : Icon.Star }
                    shortcut={
                      {
                        macOS: { modifiers: ["cmd"], key: "f" },
                        Windows: { modifiers: ["ctrl"], key: "f" },
                      }
                    }
                    onAction={() => handleToggleFavorite(item)}
                  />
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function buildMetadata(item: RichFileInfo, fullUrl: string, folders: Map<string, string>) {
  const preferences = getExtensionPreferences();
  const { fileInfo } = item;

  return (
    <Detail.Metadata>
      <Detail.Metadata.Label title="Name" text={fileInfo.name} />
      {fileInfo.originalName && (
        <Detail.Metadata.Label title="Original Name" text={fileInfo.originalName} />
      )}
      <Detail.Metadata.Label title="Type" text={fileInfo.type} />
      <Detail.Metadata.Label title="Size" text={formatFileSize(fileInfo.size)} />
      <Detail.Metadata.Separator />
      <Detail.Metadata.Label
        title="Password Protected"
        text={fileInfo.password ? "Yes" : "No"}
        icon={fileInfo.password ? Icon.Lock : undefined}
      />
      {fileInfo.maxViews !== null && (
        <Detail.Metadata.Label title="Max Views" text={fileInfo.maxViews.toString()} />
      )}
      <Detail.Metadata.Separator />
      <Detail.Metadata.Label
        title="Created At"
        text={new Date(fileInfo.createdAt).toLocaleString()}
      />
      <Detail.Metadata.Label
        title="Updated At"
        text={new Date(fileInfo.updatedAt).toLocaleString()}
      />
      {fileInfo.deletesAt && (
        <Detail.Metadata.Label
          title="Deletes At"
          text={new Date(fileInfo.deletesAt).toLocaleString()}
          icon={Icon.Clock}
        />
      )}
      <Detail.Metadata.Separator />
      {fileInfo.folderId && (
        <Detail.Metadata.Label
          title="Folder"
          text={folders.get(fileInfo.folderId) || fileInfo.folderId}
        />
      )}
      {fileInfo.tags && fileInfo.tags.length > 0 && (
        <Detail.Metadata.TagList title="Tags">
          {fileInfo.tags.map((tag) => (
            <Detail.Metadata.TagList.Item key={tag.id} text={tag.name} />
          ))}
        </Detail.Metadata.TagList>
      )}
      <Detail.Metadata.Separator />
      <Detail.Metadata.Link title="URL" target={fullUrl} text="Open in Browser" />
      {fileInfo.thumbnail && (
        <Detail.Metadata.Link
          title="Thumbnail"
          target={`${preferences.ziplineBaseUrl}${fileInfo.thumbnail.path}`}
          text="View Thumbnail"
        />
      )}
    </Detail.Metadata>
  );
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
      icon: item.fileInfo.favorite ? { source: Icon.Star, tintColor: Color.Yellow } : null,
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

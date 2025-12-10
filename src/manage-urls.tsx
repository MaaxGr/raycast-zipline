import { Action, ActionPanel, Icon, List, showToast, Toast, confirmAlert, Alert } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { getExtensionPreferences } from "./preferences";
import { UrlInfo, getUrls, deleteUrl } from "./api";

type State = {
  isLoading: boolean;
  data: UrlInfo[];
};

export default function Command() {
  const [state, setState] = useState<State>({ isLoading: true, data: [] });

  const loadUrls = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const urls = await getUrls();
      setState({ isLoading: false, data: urls });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please check your connection and try again";
      await showToast({ style: Toast.Style.Failure, title: "Failed to load URLs", message: errorMessage });
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    loadUrls();
  }, []);

  const handleDelete = async (url: UrlInfo) => {
    if (
      await confirmAlert({
        title: "Delete Short URL",
        message: `Are you sure you want to delete the short URL "${url.vanity || url.code}"?`,
        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
      })
    ) {
      try {
        await deleteUrl(url.id);
        await showToast({ style: Toast.Style.Success, title: "URL deleted" });
        await loadUrls();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Please try again";
        await showToast({ style: Toast.Style.Failure, title: "Failed to delete URL", message: errorMessage });
      }
    }
  };

  const preferences = getExtensionPreferences();

  return (
    <List isLoading={state.isLoading} isShowingDetail>
      {state.data.length === 0 && !state.isLoading && (
        <List.EmptyView icon={Icon.Link} title="No shortened URLs" description="Use 'Shorten URL' to create one" />
      )}
      {state.data.map((url) => {
        const shortUrl = `${preferences.ziplineBaseUrl}/go/${url.vanity || url.code}`;

        return (
          <List.Item
            key={url.id}
            title={url.vanity || url.code}
            subtitle={url.destination}
            icon={Icon.Link}
            accessories={[
              { icon: Icon.Eye, text: url.views.toString(), tooltip: `${url.views} views` },
              {
                date: new Date(url.createdAt),
                tooltip: `Created: ${new Date(url.createdAt).toLocaleString()}`,
              },
            ]}
            detail={
              <List.Item.Detail
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Short URL" text={shortUrl} />
                    <List.Item.Detail.Metadata.Link
                      title="Destination"
                      target={url.destination}
                      text={url.destination}
                    />
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label title="Views" text={url.views.toString()} />
                    {url.maxViews && (
                      <List.Item.Detail.Metadata.Label title="Max Views" text={url.maxViews.toString()} />
                    )}
                    <List.Item.Detail.Metadata.Label
                      title="Status"
                      text={url.enabled ? "Enabled" : "Disabled"}
                      icon={url.enabled ? Icon.CheckCircle : Icon.XMarkCircle}
                    />
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label title="Created" text={new Date(url.createdAt).toLocaleString()} />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy Short URL" content={shortUrl} />
                  <Action.OpenInBrowser title="Open Short URL" url={shortUrl} />
                  <Action.OpenInBrowser title="Open Destination" url={url.destination} />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action
                    title="Refresh"
                    icon={Icon.ArrowClockwise}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={loadUrls}
                  />
                  <Action
                    title="Delete URL"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={() => handleDelete(url)}
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

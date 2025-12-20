import { Action, ActionPanel, Form, showToast, Toast, popToRoot, useNavigation, List } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useState } from "react";
import {
  containsMdSupportedExtension,
  createMarkdownImage,
  downloadsFolder,
  getScreenshots,
  readFirstCharacters,
  parseDeletionTime,
} from "./utils";
import { isBinaryFileSync } from "isbinaryfile";
import { uploadContent, UploadOptions } from "./api";

interface UploadOptionsFormValues {
  maxViews: string;
  deletesAfter: string;
  deletesAfterCustom: string;
  password: string;
}

interface FileItem {
  file: string;
  path: string;
  lastModifiedAt: Date;
}

function FileSelectionScreen({ options }: { options: UploadOptions }) {
  const [files] = useState<FileItem[]>(getScreenshots());

  const handleUpload = async (fileItem: FileItem) => {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Uploading..." });
      await uploadContent({ filePath: fileItem.path, forceImage: false }, options);
      await popToRoot();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Upload failed", message: errorMessage });
    }
  };

  return (
    <List isShowingDetail>
      {files.length === 0 && (
        <List.EmptyView icon={{ fileIcon: downloadsFolder }} title="No files found" description="¯\_(ツ)_/¯" />
      )}

      {files.map((fileItem) => {
        const path = fileItem.path;

        let markdown;
        if (containsMdSupportedExtension(path)) {
          markdown = createMarkdownImage(encodeURI(path));
        } else if (!isBinaryFileSync(path)) {
          markdown = readFirstCharacters(path, 10_000);
        } else {
          markdown = `## Can't display binary file`;
        }

        return (
          <List.Item
            key={fileItem.path}
            title={fileItem.file}
            icon={{ fileIcon: fileItem.path }}
            quickLook={{ path: fileItem.path, name: fileItem.file }}
            accessories={[
              {
                date: fileItem.lastModifiedAt,
                tooltip: `Last modified: ${fileItem.lastModifiedAt.toLocaleString()}`,
              },
            ]}
            detail={<List.Item.Detail markdown={markdown || "Can't load preview..."} />}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action title="Upload File" onAction={() => handleUpload(fileItem)} />
                  <Action.Open title="Open File" target={fileItem.path} />
                  <Action.ToggleQuickLook shortcut={{ modifiers: ["cmd"], key: "v" }} />
                  <Action.ShowInFinder path={fileItem.path} />
                  <Action.CopyToClipboard
                    title="Copy File"
                    content={{ file: fileItem.path }}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action.OpenWith path={fileItem.path} shortcut={{ modifiers: ["cmd"], key: "o" }} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

export default function Command() {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [showCustomDeletesAfter, setShowCustomDeletesAfter] = useState(false);

  const { handleSubmit, itemProps, setValue, values } = useForm<UploadOptionsFormValues>({
    async onSubmit(values) {
      setIsLoading(true);
      try {
        const options: UploadOptions = {};

        if (values.maxViews.trim()) {
          const views = parseInt(values.maxViews.trim(), 10);
          if (!isNaN(views) && views > 0) {
            options.maxViews = views;
          }
        }

        // Use custom value if "custom" is selected and custom field has value, otherwise use dropdown value
        if (values.deletesAfter === "custom" && values.deletesAfterCustom.trim()) {
          const trimmed = values.deletesAfterCustom.trim();
          // Validate the custom input before proceeding
          const isIsoDate = trimmed.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(trimmed) || trimmed.startsWith("date=");
          const isRelativeTime = trimmed.match(/^\d+[hdwmy]$/i);
          const parsed = parseDeletionTime(trimmed);
          
          // If it's not a valid format, show error and prevent submission
          if (!parsed && !isRelativeTime && !isIsoDate) {
            await showToast({
              style: Toast.Style.Failure,
              title: "Invalid date format",
              message: "Use formats like: 05.01.2026, 01/05/2026, 2026-01-05, tomorrow, or relative time (1h, 2d)",
            });
            setIsLoading(false);
            return;
          }
          
          // Use parsed value if available, otherwise use the trimmed value (for relative time or ISO)
          options.deletesAt = parsed || trimmed;
        } else if (values.deletesAfter && values.deletesAfter !== "never" && values.deletesAfter !== "custom") {
          options.deletesAt = values.deletesAfter;
        }

        if (values.password.trim()) {
          options.password = values.password.trim();
        }

        navigation.push(<FileSelectionScreen options={options} />);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        await showToast({ style: Toast.Style.Failure, title: "Failed to configure options", message: errorMessage });
      } finally {
        setIsLoading(false);
      }
    },
    validation: {
      maxViews: (value) => {
        if (value && value.trim()) {
          const views = parseInt(value.trim(), 10);
          if (isNaN(views) || views <= 0) {
            return "Must be a positive number";
          }
        }
      },
      deletesAfterCustom: (value) => {
        if (values.deletesAfter === "custom") {
          if (!value || !value.trim()) {
            return "Custom deletion time is required when Custom is selected";
          }
          // Try to parse the value to validate it
          const trimmed = value.trim();
          // Check if it's already a valid ISO date (with or without "date=" prefix)
          const isIsoDate = trimmed.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(trimmed) || trimmed.startsWith("date=");
          const isRelativeTime = trimmed.match(/^\d+[hdwmy]$/i);
          const parsed = parseDeletionTime(trimmed);
          
          // If it's not a relative time format, not an ISO date, and parsing failed, show error
          if (!parsed && !isRelativeTime && !isIsoDate) {
            return "Invalid date format. Use formats like: 05.01.2026, 01/05/2026, 2026-01-05, tomorrow, or relative time (1h, 2d)";
          }
          
          // Additional validation: if parsed date is in the past, show error
          if (parsed && parsed.includes("T")) {
            const date = new Date(parsed);
            const now = new Date();
            if (date.getTime() <= now.getTime()) {
              return "Deletion date must be in the future";
            }
          }
        }
      },
    },
    initialValues: {
      maxViews: "",
      deletesAfter: "never",
      deletesAfterCustom: "",
      password: "",
    },
  });

  // Update custom field visibility when dropdown changes
  const handleDeletesAfterChange = (value: string) => {
    setValue("deletesAfter", value);
    setShowCustomDeletesAfter(value === "custom");
    if (value !== "custom") {
      setValue("deletesAfterCustom", "");
    }
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Select File" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        title="Max Views"
        placeholder="Unlimited"
        info="Maximum number of views before the file expires"
        {...itemProps.maxViews}
      />
      <Form.Separator />
      <Form.Dropdown
        id="deletesAfter"
        title="Deletes After"
        info="Time interval when the file should be automatically deleted"
        value={values.deletesAfter}
        onChange={handleDeletesAfterChange}
      >
        <Form.Dropdown.Item value="never" title="Never" />
        <Form.Dropdown.Item value="30m" title="30 Minutes" />
        <Form.Dropdown.Item value="1h" title="1 Hour" />
        <Form.Dropdown.Item value="2h" title="2 Hours" />
        <Form.Dropdown.Item value="6h" title="6 Hours" />
        <Form.Dropdown.Item value="12h" title="12 Hours" />
        <Form.Dropdown.Item value="1d" title="1 Day" />
        <Form.Dropdown.Item value="2d" title="2 Days" />
        <Form.Dropdown.Item value="3d" title="3 Days" />
        <Form.Dropdown.Item value="1w" title="1 Week" />
        <Form.Dropdown.Item value="2w" title="2 Weeks" />
        <Form.Dropdown.Item value="1m" title="1 Month" />
        <Form.Dropdown.Item value="3m" title="3 Months" />
        <Form.Dropdown.Item value="6m" title="6 Months" />
        <Form.Dropdown.Item value="1y" title="1 Year" />
        <Form.Dropdown.Item value="custom" title="Custom" />
      </Form.Dropdown>
      {showCustomDeletesAfter && (
        <Form.TextField
          title="Custom Deletion Time"
          placeholder='e.g., "2h", "05.01.2026", "tomorrow", or "2026-01-05"'
          info="Supports: relative time (1h, 2d), dates (05.01.2026, 01/05/2026, 2026-01-05), or natural language (tomorrow, next week)"
          {...itemProps.deletesAfterCustom}
        />
      )}
      <Form.PasswordField
        title="Password"
        placeholder="Optional password"
        info="Protect the file with a password"
        {...itemProps.password}
      />
    </Form>
  );
}


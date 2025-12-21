import { Action, ActionPanel, Form, showToast, Toast, popToRoot, useNavigation, List, Clipboard, Icon } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useState, useEffect } from "react";
import {
  containsMdSupportedExtension,
  createMarkdownImage,
  downloadsFolder,
  getScreenshots,
  readFirstCharacters,
  parseDeletionTime,
} from "./utils";
import { isBinaryFileSync } from "isbinaryfile";
import { uploadContent, UploadOptions, getFolders, FolderInfo } from "./api";
import { getCommandPreferences } from "./preferences";

interface UploadOptionsFormValues {
  maxViews: string;
  deletesAfter: string;
  deletesAfterCustom: string;
  password: string;
  folder: string;
  format: string;
  filename: string;
  originalName: boolean;
  imageCompressionPercent: string;
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

function ClipboardSelectionScreen({ options }: { options: UploadOptions }) {
  const [clipboard, setClipboard] = useState<Clipboard.ReadContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadClipboardContent() {
      try {
        const initialItems: Clipboard.ReadContent[] = (
          await Promise.all(
            Array.from({ length: 6 }, (_, i) => i).map(async (index) => {
              return await Clipboard.read({ offset: index });
            }),
          )
        ).filter((item) => item.text !== undefined);
        setClipboard(initialItems);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await showToast({ style: Toast.Style.Failure, title: "Failed to read clipboard", message: errorMessage });
      } finally {
        setIsLoading(false);
      }
    }

    loadClipboardContent();
  }, []);

  const handleUpload = async (clipboardItem: Clipboard.ReadContent) => {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Uploading..." });

      if (clipboardItem.file != undefined) {
        const path = decodeURI(clipboardItem.file?.replace("file://", ""));
        const isImageFromClipboard = path.startsWith("/var") && clipboardItem.text.includes("Image (");
        await uploadContent({ filePath: path, forceImage: isImageFromClipboard }, options);
      } else {
        await uploadContent({ textContent: clipboardItem.text }, options);
      }

      await popToRoot();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Upload failed", message: errorMessage });
    }
  };

  return (
    <List isShowingDetail isLoading={isLoading}>
      {clipboard.length === 0 && !isLoading && (
        <List.EmptyView
          icon={{ fileIcon: downloadsFolder }}
          title="No clipboard content"
          description="Copy something to your clipboard first"
        />
      )}

      {clipboard.map((clipboardItem, index) => {
        let markdown = "";
        const path = clipboardItem.file?.replace("file://", "");

        if (path != null) {
          if (containsMdSupportedExtension(path) || path.startsWith("/var")) {
            markdown = `![Image Preview](${path})`;
          } else if (!isBinaryFileSync(path)) {
            markdown = readFirstCharacters(path, 10_000);
          } else {
            markdown = `## Can't display binary file`;
          }
        } else {
          markdown = "```\n" + clipboardItem.text + "\n```";
        }

        let icon: Icon | { fileIcon: string } = Icon.Document;
        if (clipboardItem.file != null) {
          icon = { fileIcon: clipboardItem.file };
        }

        return (
          <List.Item
            key={`${index}-${clipboardItem.file ?? clipboardItem.text}`}
            title={clipboardItem.text}
            icon={icon}
            detail={<List.Item.Detail markdown={markdown} />}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action title="Upload File" onAction={() => handleUpload(clipboardItem)} />
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
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const localePreferences = getCommandPreferences();

  useEffect(() => {
    async function loadFolders() {
      try {
        const folderList = await getFolders();
        setFolders(folderList);
      } catch (error) {
        console.error("Failed to load folders", error);
      } finally {
        setFoldersLoading(false);
      }
    }
    loadFolders();
  }, []);

  const buildOptions = async (values: UploadOptionsFormValues): Promise<UploadOptions | null> => {
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
      const parsed = parseDeletionTime(trimmed, localePreferences);
      
      // If it's not a valid format, show error and prevent submission
      if (!parsed && !isRelativeTime && !isIsoDate) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Invalid date format",
          message: "Use formats like: 05.01.2026, 01/05/2026, 2026-01-05, tomorrow, or relative time (1h, 2d)",
        });
        return null;
      }
      
      // Use parsed value if available, otherwise use the trimmed value (for relative time or ISO)
      options.deletesAt = parsed || trimmed;
    } else if (values.deletesAfter && values.deletesAfter !== "never" && values.deletesAfter !== "custom") {
      options.deletesAt = values.deletesAfter;
    }

    if (values.password.trim()) {
      options.password = values.password.trim();
    }

    if (values.folder.trim()) {
      options.folder = values.folder.trim();
    }

    if (values.format.trim()) {
      options.format = values.format.trim();
    }

    if (values.filename.trim()) {
      options.filename = values.filename.trim();
    }

    if (values.originalName) {
      options.originalName = true;
    }

    if (values.imageCompressionPercent.trim()) {
      const compression = parseInt(values.imageCompressionPercent.trim(), 10);
      if (!isNaN(compression) && compression >= 0 && compression <= 100) {
        options.imageCompressionPercent = compression;
      }
    }

    return options;
  };

  const handleFileUpload = async () => {
    setIsLoading(true);
    try {
      const options = await buildOptions(values);
      if (options === null) {
        setIsLoading(false);
        return;
      }
      navigation.push(<FileSelectionScreen options={options} />);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      await showToast({ style: Toast.Style.Failure, title: "Failed to configure options", message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClipboardUpload = async () => {
    setIsLoading(true);
    try {
      const options = await buildOptions(values);
      if (options === null) {
        setIsLoading(false);
        return;
      }
      navigation.push(<ClipboardSelectionScreen options={options} />);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      await showToast({ style: Toast.Style.Failure, title: "Failed to configure options", message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const { itemProps, setValue, values } = useForm<UploadOptionsFormValues>({
    onSubmit: async () => {
      // Form submission is handled by ActionPanel actions
      return true;
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
      format: (value) => {
        if (value && value.trim()) {
          const validFormats = ["random", "date", "uuid", "name", "gfycat"];
          if (!validFormats.includes(value)) {
            return "Must be one of: random, date, uuid, name, gfycat";
          }
        }
      },
      imageCompressionPercent: (value) => {
        if (value && value.trim()) {
          const compression = parseInt(value.trim(), 10);
          if (isNaN(compression) || compression < 0 || compression > 100) {
            return "Must be a number between 0 and 100";
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
          const parsed = parseDeletionTime(trimmed, localePreferences);
          
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
      folder: "",
      format: "",
      filename: "",
      originalName: false,
      imageCompressionPercent: "",
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
      isLoading={isLoading || foldersLoading}
      actions={
        <ActionPanel>
          <Action title="Upload from File" onAction={handleFileUpload} />
          <Action title="Upload from Clipboard" onAction={handleClipboardUpload} />
        </ActionPanel>
      }
    >
      {folders.length > 0 ? (
        <Form.Dropdown
          id="folder"
          title="Folder"
          info="Select a folder to organize your upload"
          value={values.folder}
          onChange={(value) => setValue("folder", value)}
        >
          <Form.Dropdown.Item value="" title="None" />
          {folders.map((folder) => (
            <Form.Dropdown.Item key={folder.id} value={folder.id} title={folder.name} />
          ))}
        </Form.Dropdown>
      ) : (
        <Form.TextField
          id="folder"
          title="Folder ID"
          placeholder="Optional folder ID"
          info="Enter a folder ID to organize your upload (leave empty for no folder)"
          value={values.folder}
          onChange={(value) => setValue("folder", value)}
        />
      )}
      <Form.Dropdown
        id="format"
        title="Naming Format"
        info="Determines how the uploaded file will be named"
        value={values.format}
        onChange={(value) => setValue("format", value)}
      >
        <Form.Dropdown.Item value="" title="Default (Random)" />
        <Form.Dropdown.Item value="random" title="Random" />
        <Form.Dropdown.Item value="date" title="Date" />
        <Form.Dropdown.Item value="uuid" title="UUID" />
        <Form.Dropdown.Item value="name" title="Name" />
        <Form.Dropdown.Item value="gfycat" title="Gfycat" />
      </Form.Dropdown>
      <Form.TextField
        id="filename"
        title="Custom Filename"
        placeholder="Optional custom filename"
        info="Override the filename (takes precedence over format and original name settings)"
        value={values.filename}
        onChange={(value) => setValue("filename", value)}
      />
      <Form.Checkbox
        id="originalName"
        label="Preserve Original Name"
        info="Keep the original filename of the uploaded file"
        value={values.originalName}
        onChange={(value) => setValue("originalName", value)}
      />
      <Form.TextField
        title="Image Compression"
        placeholder="0-100"
        info="Compression level for images (0-100, where 100 is no compression). Only applies to image files."
        {...itemProps.imageCompressionPercent}
      />
      <Form.TextField
        title="Max Views"
        placeholder="Unlimited"
        info="Maximum number of views before the file expires"
        {...itemProps.maxViews}
      />
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
          placeholder='e.g., "2h", "05.01.2026", "tomorrow", "in 3 days", or "March 15, 2026"'
          info="Supports: relative time (1h, 2d), dates (05.01.2026, 01/05/2026, 2026-01-05), or natural language (tomorrow, next week, in 3 days, March 15, 2026)"
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

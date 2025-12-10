import { List, Icon } from "@raycast/api";

export default function Command() {
  return (
    <List>
      <List.EmptyView
        icon={Icon.Upload}
        title="Zipline"
        description="Use the commands to upload files, shorten URLs, or manage your uploads."
      />
    </List>
  );
}

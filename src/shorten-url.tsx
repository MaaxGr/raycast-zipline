import { Action, ActionPanel, Form, showToast, Toast, Clipboard, popToRoot } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useEffect, useState } from "react";
import { shortenUrl } from "./api";

interface ShortenUrlFormValues {
  url: string;
  vanity: string;
  password: string;
  maxViews: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);

  const { handleSubmit, itemProps, setValue } = useForm<ShortenUrlFormValues>({
    async onSubmit(values) {
      setIsLoading(true);
      try {
        await showToast({ style: Toast.Style.Animated, title: "Shortening URL..." });

        const options: { vanity?: string; password?: string; maxViews?: number } = {};

        if (values.vanity.trim()) {
          options.vanity = values.vanity.trim();
        }
        if (values.password.trim()) {
          options.password = values.password.trim();
        }
        if (values.maxViews.trim()) {
          const views = parseInt(values.maxViews.trim(), 10);
          if (!isNaN(views) && views > 0) {
            options.maxViews = views;
          }
        }

        await shortenUrl(values.url.trim(), options);
        await popToRoot();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        await showToast({ style: Toast.Style.Failure, title: "Failed to shorten URL", message: errorMessage });
      } finally {
        setIsLoading(false);
      }
    },
    validation: {
      url: (value) => {
        if (!value) {
          return "URL is required";
        }
        const urlPattern = /^https?:\/\/[^\s]+$/;
        if (!urlPattern.test(value.trim())) {
          return "URL must start with http:// or https://";
        }
      },
      maxViews: (value) => {
        if (value && value.trim()) {
          const views = parseInt(value.trim(), 10);
          if (isNaN(views) || views <= 0) {
            return "Must be a positive number";
          }
        }
      },
    },
    initialValues: {
      url: "",
      vanity: "",
      password: "",
      maxViews: "",
    },
  });

  useEffect(() => {
    Clipboard.readText().then((text) => {
      if (text) {
        const urlPattern = /^https?:\/\/[^\s]+$/;
        if (urlPattern.test(text.trim())) {
          setValue("url", text.trim());
        }
      }
    });
  }, [setValue]);

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Shorten URL" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        title="URL"
        placeholder="https://example.com/very-long-url"
        info="The URL you want to shorten"
        {...itemProps.url}
      />
      <Form.TextField
        title="Custom Alias"
        placeholder="my-short-link"
        info="Optional custom alias for the short URL"
        {...itemProps.vanity}
      />
      <Form.Separator />
      <Form.PasswordField
        title="Password"
        placeholder="Optional password"
        info="Protect the short link with a password"
        {...itemProps.password}
      />
      <Form.TextField
        title="Max Views"
        placeholder="Unlimited"
        info="Maximum number of views before the link expires"
        {...itemProps.maxViews}
      />
    </Form>
  );
}

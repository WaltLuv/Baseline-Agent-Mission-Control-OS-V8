# Memory Setup Guide

Memory is how your AI workforce remembers how your business operates.

## Obsidian — your existing markdown vault

1. **Choose vault path.** Settings → Integrations → Obsidian. Set the absolute path to your vault.
2. **Sync markdown.** Click Sync. Mission Control reads your vault and surfaces its notes as Business Knowledge.
3. **View citations.** When an employee uses a note, the answer shows the file path as a citation.
4. **Open source notes.** Click any citation to open the original markdown file.
5. **Privacy rules.** Vault contents stay on disk. Mission Control reads them; it never re-publishes them outside your workspace.

## Notion — connect your knowledge base

1. **Create the Notion integration.** In Notion: Settings → Integrations → New integration. Capture the secret.
2. **Share pages / database.** In Notion, share the pages or database you want Mission Control to read with your new integration.
3. **Add the token.** In Mission Control: Settings → Integrations → Notion. Paste the secret.
4. **Sync.** Click Sync. Pages appear in your Business Knowledge Base. Delta sync runs in the background.
5. **View citations.** Employees cite Notion pages by title. Click to open in Notion.
6. **Disconnect.** Settings → Integrations → Notion → Disconnect.

## Knowledge Intelligence — deeper memory

1. **Add the API key.** Settings → Integrations → Knowledge Intelligence. Paste the provider key.
2. **Index / namespace** is configured by Mission Control automatically. No jargon exposed to operators.
3. **Sync.** Click Sync. The index hydrates in the background. You will see "Ready" when complete.
4. **View as Knowledge Intelligence.** Memory appears under Knowledge Intelligence — not under any vendor name.

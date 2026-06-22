# Privacy Policy

Last updated: 2026-06-22

GEO Copilot is a browser extension for GEO workflow analysis, content drafting, and post-publish review.

## Data Stored Locally

The extension may store the following data in the browser's local extension storage:

- Captured article titles, outlines, keywords, and structure patterns.
- Captured LLM answer summaries, source domains, recommended model names, and platform analysis.
- AI diagnosis reports, generated article drafts, and post-publish review notes.
- Basic settings such as company/brand name, industry scenario, banned claims, and API configuration.

This data is stored locally using `chrome.storage.local`.

## Data Sent to External APIs

If you configure an OpenAI-compatible API provider and click an AI generation button, the extension sends the generated prompt to the API endpoint you configured.

The prompt may include:

- Captured LLM answer analysis.
- Captured article structure.
- Product or content information you pasted into the dashboard.
- Your configured company/brand and industry scenario.

The extension does not send this data to any GEO Copilot-owned server.

## API Keys

API keys are stored locally in your browser extension storage. They are used only to call the API endpoint you configure.

## Page Access

The extension can analyze the current page after you explicitly open the panel and click `GEO START` or use a capture action. It does not automatically upload page content to a remote server.

## Clipboard

The extension may write generated prompts, reports, or article drafts to the clipboard when you click a copy button.

## Data Deletion

You can clear captured data, reports, drafts, and review records from the extension popup or dashboard.

## Contact

For questions about this extension, contact the publisher listed on the extension store page or GitHub repository.

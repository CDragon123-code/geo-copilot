# GEO Copilot

GEO Copilot is a Chrome/Edge browser extension for product-focused GEO work. It helps you turn large-model search results, cited source platforms, and reference article structures into publishable content and post-publish review notes.

The workflow is designed for practitioners who repeatedly ask LLMs product-selection questions, inspect the cited platforms, rewrite content for those platforms, publish it, and then test the same question again after a few days.

## What It Does

- Captures LLM answers and source links from pages such as DeepSeek, Qwen, Doubao, Kimi, ChatGPT, and Claude.
- Detects recommended product models, source domains, platform signals, answer structure, and content gaps.
- Captures article structure from ordinary websites, forums, blogs, industry platforms, and official pages.
- Separates LLM platforms from content platforms to avoid mixed analysis.
- Uses an OpenAI-compatible API to generate GEO diagnosis, platform strategy, publish-ready drafts, and post-publish review conclusions.
- Supports manual `GEO START` analysis so each new page is analyzed only when you explicitly start it.
- Stores data locally in `chrome.storage.local` by default.

## Core Workflow

1. Search a product-related question in a general LLM platform.
2. Open GEO Copilot and click `GEO START` to capture the answer, recommended products, and cited source links.
3. Open the cited source platforms and capture reference article structures.
4. Go to the dashboard and generate a source diagnosis.
5. Paste the target product information and reference structure into the `GEO投放仿写` section.
6. Generate a publish-ready article that borrows structure but rewrites title, angle, paragraph order, cases, FAQ, and parameter table to reduce duplication risk.
7. Publish the article on the matched platform.
8. After a few days, search the same question again and paste the new LLM answer into `发布后复测` to get the next optimization actions.

## Dashboard Sections

- `AI诊断`: analyzes model source patterns, platform priority, content gaps, and recommended article structure.
- `GEO投放仿写`: turns the current product information and reference article structure into a publish-ready article.
- `发布后复测`: compares post-publish model answers and checks whether your product or platform source is being recommended.
- `设置`: stores only long-term basics such as company/brand, industry scenario, banned claims, and API settings.
- `记录`: keeps diagnosis reports, drafts, review notes, and captured data separately.

## API Providers

The dashboard supports OpenAI-compatible `/chat/completions` APIs. Built-in presets include:

- DeepSeek
- Qwen
- Doubao / Volcengine Ark
- Kimi / Moonshot
- Zhipu GLM
- OpenAI
- Custom OpenAI-compatible endpoint

API keys are stored only in the local browser storage of the installed extension.

## Install Locally

1. Open Chrome or Edge extension management.
2. Enable developer mode.
3. Choose `Load unpacked`.
4. Select this project folder.
5. Pin GEO Copilot to the toolbar.

## Package for Store Submission

Create a ZIP package with the extension files at the root:

```powershell
Compress-Archive -Path manifest.json,popup.html,dashboard.html,src,assets,README.md,PRIVACY.md -DestinationPath geo-copilot-v0.1.0.zip -Force
```

Do not include `.git`, `demo`, `node_modules`, or existing `.zip` files in the store package.

## File Structure

```text
manifest.json
popup.html
dashboard.html
src/
  analyzer.js
  background.js
  content.js
  content.css
  dashboard.js
  popup.js
  ui.css
assets/
  icons/
demo/
README.md
PRIVACY.md
```

## Privacy

GEO Copilot does not run a backend service. Captured page data, diagnosis reports, generated drafts, and API settings are stored locally in the browser unless you explicitly export or copy them. When you use an external model API, the prompt content is sent directly from your browser to the API endpoint you configure.

See [PRIVACY.md](PRIVACY.md) for details.

## Status

This is an MVP for validating a practical GEO workflow. It is suitable for local testing and store submission preparation, but you should review permissions, privacy text, screenshots, and store listing copy before public release.

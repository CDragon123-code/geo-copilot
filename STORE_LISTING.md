# Store Listing Draft

## Name

GEO Copilot

## Short Description

Analyze LLM source patterns, match publishing platforms, rewrite GEO articles, and review post-publish results.

## Description

GEO Copilot is a browser extension for product-focused GEO workflows.

It helps practitioners capture LLM answers, inspect cited source platforms, learn article structures, generate publish-ready drafts, and review whether published content begins to influence future LLM answers.

Key features:

- Capture LLM answer sources and recommendation patterns.
- Identify recommended product models and cited platforms.
- Capture article structures from industry platforms and reference pages.
- Generate GEO diagnosis with platform priority and content gaps.
- Rewrite product content for matched platforms while reducing duplication risk.
- Review post-publish LLM answers and plan the next optimization round.
- Store captured data locally in the browser.

The extension is designed for manual, controlled workflows. It analyzes the current page only when the user starts the analysis.

## Permissions Explanation

- `activeTab`: access the current tab when the user starts analysis.
- `storage`: save settings, captured data, reports, drafts, and review notes locally.
- `clipboardWrite`: copy prompts, reports, and generated drafts when the user clicks copy.
- `scripting`: open and control the page-side panel.
- `<all_urls>`: allow the extension to work across LLM platforms, industry platforms, blogs, forums, and official websites used in GEO workflows.

## Privacy Summary

GEO Copilot stores data locally in the browser. It does not operate its own backend server. When the user configures an external model API and runs AI diagnosis or drafting, prompt content is sent directly from the browser to the configured API endpoint.

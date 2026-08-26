---
"agentic": patch
---

Keep Safe Chain as the only package-manager wrapper in Codespaces and Cursor Cloud Agents

Do not stack [PMG](https://github.com/safedep/pmg) on the DevContainer or Cursor bootstrap. It
shares PATH shims and a registry proxy with Safe Chain, so a second wrapper either bypasses one
feed or nests two MITM proxies. Install-time intel on CI stays Socket Firewall.

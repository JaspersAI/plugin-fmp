# plugin-fmp

Financial Modeling Prep for [Jaspers Terminal](https://github.com/JaspersAI), an open source, extensible desktop terminal for financial research.

Declares `fmp/mcp`, Financial Modeling Prep's MCP server, and makes three of its tools sources (`news`, `technical-indicators`, `form-13f`), with two views: `fmp/news` and `fmp/technicals`, each about one company. What answers depends on your FMP plan: Starter has news and technical indicators; Form 13F needs Ultimate.

## Install

In Jaspers Terminal, open Settings > Plugins, paste

```
https://github.com/JaspersAI/plugin-fmp
```

and press Install. The app downloads the latest release, shows where it came from, and asks before any of it runs. A plugin runs code on your computer with your permissions, so install plugins only from people you trust.

## Keys

- **FMP API key**, from <https://site.financialmodelingprep.com/developer/docs>.

The app asks for a key the first time something needs it, or take it in Settings > Plugins. It is sealed in your OS keychain and never reaches the plugin or the assistant.

## Needs

Nothing else.

## Develop

```sh
git clone https://github.com/JaspersAI/plugin-fmp.git ~/Jaspers/plugins/fmp
cd ~/Jaspers/plugins/fmp
npm install
npm run typecheck
npm test
```

A folder you put in `~/Jaspers/plugins` is a plugin of your own, which the app rebuilds whenever you save. If this plugin is installed, remove it in Settings > Plugins first: the clone goes where the installed copy lives. Types come from [`@jaspers-ai/sdk`](https://www.npmjs.com/package/@jaspers-ai/sdk), which the app provides at run time.

## Release

Bump `version` in `package.json`, commit, and push a tag:

```sh
npm version patch
git push --follow-tags
```

The Release workflow checks the plugin and attaches `fmp-<version>.zip` to a GitHub release. Update in Settings > Plugins picks it up.

## License

[MIT](LICENSE)

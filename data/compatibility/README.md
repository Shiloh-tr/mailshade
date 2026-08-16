# Compatibility catalog

`caniemail-snapshot.json` is a normalized, pinned snapshot of the public [Can I Email](https://www.caniemail.com/) feature data from [hteumeuleu/caniemail](https://github.com/hteumeuleu/caniemail).

The upstream data is MIT licensed. Copyright remains with its contributors. The snapshot preserves support observations and notes; it does not infer Mailshade rendering behavior.

Regenerate from a local upstream checkout:

```sh
npm run compatibility:sync -- --source /path/to/caniemail --commit 1f500feec9df3241bfe679b16101d1ee449e67e9
```


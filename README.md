# RSS Filter

[![rss-filter](https://img.shields.io/badge/LICENSE-AGPLv3%20Liscense-blue?style=flat-square)](./LICENSE)
[![rss-filter](https://img.shields.io/badge/GitHub-RSS%20Filter-blueviolet?style=flat-square&logo=github)](https://github.com/fernvenue/rss-filter)
[![rss-filter](https://img.shields.io/badge/GitLab-RSS%20Filter-orange?style=flat-square&logo=gitlab)](https://gitlab.com/fernvenue/rss-filter)

RSS Filter, based on Cloudflare Workers and KV storage.

## Usage

First, go to [Storage & Database > KV](https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces) to create a KV namespace. Select **Create a namespace**, enter a name for this namespace, here I use `RSS Filter Rules`, then select **Add**.

Now, go to [Workers & Pages > Overview](https://dash.cloudflare.com/?to=/:account/workers-and-pages) to create a Worker, paste [worker.js](./worker.js) to it and save. After that, go to your Worker **Settings**, you can bind KV in **Bindings**, just choose bind a KV, **Variable name** should be `RSS_FILTER_RULES` here, then choose your KV namespace.

And now, you can configure the RSS URL and the regular expressions you want in KV. Here are some examples:

- Filter content that only includes some keywords: `(Hello|World)`
- Filter out content that contains a specific keyword: `^(?!.*Keyword).*`

In this way, we can filter through `https://worker-rss-filter.example.com/-/https://real-rss-url.example.com`.

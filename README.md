sw-pack
=======

Generate service workers for web-app deployment with offline-first support.

Only supports node 6+

## Usage

```javascript
const packager = require('sw-pack');

packager.generate({
  cache: ['index.html', 'style.css', 'https://example.com/script.js'],
  out: './service-worker.js'
});
```

## Features

* Caches files by hash, only updates files which changed
* Does not touch cache which is currently in use
* Can cache external URLs

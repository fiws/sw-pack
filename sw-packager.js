'use strict';

const got = require('got');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const pre = require('preprocess');

const SW_PACK_REVISION = 1; // used for breaking structure changes
var isHttp = (p) => /^https?:\/\//.test(p);

const packer = {};

packer.generate = (opts = {}) => {
  if (opts.cache === undefined) throw new Error('cache option must be supplied.');
  if (Array.isArray(opts.cache) === false) {

    // babel...
    if (opts.cache.constructor && opts.cache.constructor.name === 'Set') {
      opts.cache = Array.from(opts.cache);
    } else {
      throw new Error('cache option must be an Array or Set');
    }
  }
  if (!opts.root) {
    //opts.root = path.resolve(path.dirname(opts.cache[0]));
    opts.root = process.cwd();
  }

  if (!opts.out) {
    opts.out = opts.root + '/sw-pack.json';
  } else {
    if (path.extname(opts.out) === '') opts.out += '/sw-pack.json';
    opts.out = path.resolve(opts.out);
  }

  opts.cache = resolvePaths(opts.cache, opts.root);
  opts.cache = deduplicate(opts.cache);

  return packer.hashFiles(opts.cache)
    .then(d => relativePaths(d, opts.root))
    .then(d => packer.generatePackage(d, opts.version))
    .then(packer.hashPackage)
    .then(p => packer.writeServiceWorker(p, opts.out))
    .catch(console.error);
}

packer.hashFiles = (files) => {
  return Promise.all(files.map(packer.calcSha));
}

// generates a new sw-pack
packer.generatePackage = (cache, version = 'unknown') => {
  var pack = {
    cache,
    version,
    hash: null, // should be generated with hashPackage
    _revision: SW_PACK_REVISION
  };
  return pack;
}

packer.writeServiceWorker = (pack, path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(__dirname + '/service-worker.template.js', (err, template) => {
      if (err) reject(err);
      let sw = pre.preprocess(template.toString(), {
        SW_PACK: pack,
        NODE_ENV: 'production',
        SW_PACK_DEFINITION: 'SW_PACK = ' + JSON.stringify(pack)
      }, { type: 'js' });
      fs.writeFile(path, sw, (err) => {
        if (err) reject(err);
        else resolve(path);
      });
    })
  });
}

// concatines all pack.cache hashes and returns a sha1 of them
packer.hashPackage = (pack) => {
  return new Promise((resolve, reject) => {
    var hash = crypto.createHash('sha1');
    pack.cache.forEach((f) => hash.write(f.hash));
    hash.end();
    hash.on('data', (hash) => {
      pack.hash = hash.toString('hex');
      resolve(pack);
    });
    hash.on('error', reject);
  });
}

// calculates the sha1sum of a file. supports http
packer.calcSha = (p) => {
  return new Promise((resolve, reject) => {
    var read = null;
    if (isHttp(p) === false) {
      read = fs.createReadStream(p); // file system
    } else {
      read = got.stream(p); // http stream
    }
    read.on('error', reject);
    var hash = crypto.createHash('sha1');
    read.pipe(hash);
    hash.on('error', reject);
    hash.on('data', (d) => {
      resolve({
        path: p,
        hash: d.toString('hex')
      });
    });
  });
}

function deduplicate(cache) {
  return Array.from(new Set(cache));
}

// relativates all given paths to the given root
function relativePaths(cache, root = process.cwd()) {
  return cache.map((item) => {
    var p = item.path;
    item.path = isHttp(p) ? p : path.relative(root, p);
    return item;
  });
}

// relativates all given paths to the given root
function resolvePaths(cache, root = process.cwd()) {
  return cache.map((p) => isHttp(p) ? p : path.resolve(root, p));
}

module.exports = packer;

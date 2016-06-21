'use strict';

const test = require('ava');
const packager = require('../sw-packager');
const tempfile = require('tempfile');
const fs = require('mz/fs');

const expectedResults = [
  { path: './fixtures/demo.html', hash: '83d39573bc83cb40a918d2fc508101b2e1a4fe43' },
  { path: './fixtures/demo.css', hash: '3098d503d9c8a3876b53cd448093111125a23102' },
  {
    path: 'https://cdnjs.cloudflare.com/ajax/libs/trianglify/0.4.0/trianglify.min.js',
    hash: '022fd71112fc74c3ba0875e0200dc99ad2e29a7c'
  }
];

const demoFiles = expectedResults.map(f => f.path);


test('should hash a file', async t => {
  const file = await packager.calcSha('./fixtures/demo.html');

  t.is(file.hash, '83d39573bc83cb40a918d2fc508101b2e1a4fe43', 'incorrect hash');
  t.pass();
});

test('hashing should fail if file does not exist', t => {
  const hash = packager.calcSha('./fixtures/demø.html');
  t.plan(1);

  return hash.catch((e) => {
    t.pass('error thrown');
  })
});

test('should hash multiple files', async t => {
  t.plan(3);
  const files = await packager.hashFiles(demoFiles);

  t.truthy(Array.isArray(files), 'result not an array');
  t.is(files.length, 3, 'length not equal to input');

  t.deepEqual(files, expectedResults, 'same as expected');
});

test('should write a service-worker', async t => {
  const out = tempfile('.js');
  const bar = await packager.writeServiceWorker({}, out);

  // TODO: assertions missing here
  t.truthy(await fs.exists(out), 'file not written');
});

test('should fail to write a service-worker if path is invalid', t => {
  const out = '/tmp/should/never/exist/random/service-worker.js';
  const writing = packager.writeServiceWorker({}, out);

  // TODO: assertions missing here
  t.throws(writing, /ENOENT/, 'throws');
});

test('should generate a service worker', async t => {
  const out = tempfile('.js');
  await packager.generate({
    cache: demoFiles,
    version: '0.0.1',
    out,
    root: './'
  });

  // TODO: assertions missing here
  t.truthy(await fs.exists(out), 'file not written');
});

test('should generate a with cache beeing a Set', async t => {
  const out = tempfile('.js');
  const cache = new Set(demoFiles);

  await packager.generate({
    cache,
    version: '0.0.1',
    out
  });

  // TODO: assertions missing here
  t.truthy(await fs.exists(out), 'file not written');
});

test('don\'t generate when there is nothing to cache', async t => {
  t.plan(1);
  const out = tempfile('.js');

  t.throws(packager.generate, 'cache option must be supplied.', 'error thrown');

});

test('don\'t generate when cache is string or something', async t => {
  t.plan(1);
  const out = tempfile('.js');

  t.throws(
    () => packager.generate({ cache: 'no'}),
    'cache option must be an Array or Set',
    'error thrown'
  );

});

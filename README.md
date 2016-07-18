# documentdb-client [![Build Status](https://travis-ci.org/ralphtheninja/documentdb-client.svg?branch=master)](https://travis-ci.org/ralphtheninja/documentdb-client)

Convenience module for wrapping a [`DocumentDB`](https://github.com/Azure/azure-documentdb-node) collection with strong consistency and automatic indexing.

### Usage

```js
const DB = require('documentdb-client')
const db = DB({
  databaseId: 'my-documentdb',
  host: 'https://my-documentdb.documents.azure.com:443/',
  masterKey: 'q7dMeDOhIUASP2GtWRPnrbZ6K7IO91AgaYiOCsvImmoUJKRSTjI7CNf0mEehGh4czRo17yED5AmPN1wERf367=='
})

const coll = db.createCollection('my-collection')

coll.put(data, function (err, result) {
  coll.get(data.id, function (err, result) {
    if (!err) console.log('.get() OK', JSON.stringify(result, null, 2))
  })
})
```

### Api

#### `const db = DB(options)`

Creates a `DocumentDB` client where `options` take the following properties:

* `databaseId` database id
* `host` database host
* `masterKey` database master key

The database will be created if it doesn't exist.

#### `db.update(self, data, cb)`

Updates document with `data` using document `self` reference.

#### `db.delete(self, cb)`

Deletes document with `data` using document `self` reference.

#### `const coll = db.createCollection(id)`

Returns a `Collection` object. Creates the collection if it doesn't exist.

#### `coll.put(data, cb)`

Stores `data` document as `{ data: data }` where `data.id` must be set. On success, calls back with the same JSON document with additional meta data properties set by `DocumentDB`.

Example of meta data properties:

```json
{
  "data": {
    "key1": "value1",
    "key2": "value2",
    "id": "AGJMqmtbTVarTf"
  },
  "id": "AGJMqmtbTVarTf",
  "_rid": "Mwl6APp1TAAXBBBBBB==",
  "_self": "dbs/Mwl6AA==/colls/Mwl6APp1TAA=/docs/Mwl6APp1TAAXBBBBBB==/",
  "_etag": "\"00000800-0000-0000-0000-5744210b0000\"",
  "_attachments": "attachments/",
  "_ts": 1464082697
}
```

#### `coll.get(id, cb)`

Gets a document from a collection. Calls back with `data` stored at `id`.

#### `coll.query(query, cb)`

Queries a collection using an SQL `query`.

Example of a query using the document `id`:

```js
const query = {
  query: 'SELECT * FROM root r WHERE r.id = @id',
  parameters: [{ name: '@id', value: id }]
}
```

#### `coll.update(self, data, cb)`

Aliases `db.update()`.

#### `coll.delete(self, cb)`

Aliases `db.delete()`.

### License

MIT

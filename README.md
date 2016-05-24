# documentdb-client

Convenience module for wrapping a [`DocumentDB`](https://github.com/Azure/azure-documentdb-node) collection with strong consistency and automatic indexing.

### Usage

```js
const createDb = require('documentdb-client')
const db = createDb({
  databaseId: 'my-documentdb',
  collectionId: 'my-collection',
  host: 'https://my-documentdb.documents.azure.com:443/',
  masterKey: 'q7dMeDOhIUASP2GtWRPnrbZ6K7IO91AgaYiOCsvImmoUJKRSTjI7CNf0mEehGh4czRo17yED5AmPN1wERf367=='
})

db.put(data, function (err, result) {
  db.get(data.id, function (err, result) {
    if (!err) console.log('.get() OK', JSON.stringify(result, null, 2))
  })
})
```

### Api

#### `const db = createDb(options)`

Creates a `DocumentDB` client where `options` take the following properties:

* `databaseId` database id
* `collectionId` collection id
* `host` database host
* `masterKey` database master key

The database and the collection will be created if they don't exist.

#### `db.put(data, cb)`

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

#### `db.get(id, cb)`

Calls back with `data` stored at `id`.

#### `db.update(self, data, cb)`

Replaces document with `data` using `._self` meta property.

#### `db.delete(self, cb)`

Deletes document with `data` using `._self` meta property.

#### `db.query(query, cb)`

Queries the collection using an SQL `query`.

Example of a query using the document `id`:

```js
const query = {
  query: 'SELECT * FROM root r WHERE r.id = @id',
  parameters: [{ name: '@id', value: id }]
}
```

### License

MIT

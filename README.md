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
const data = { id: '1234', some: 'value' }
coll.put(data, function (err, result) {
  coll.get(data.id, function (err, result) {
    if (!err) console.log('.get() OK', JSON.stringify(result, null, 2))
  })
})
```

### Api

#### `const db = DB(options)`

Creates a `DocumentDB` client where `options` take the following properties:

* `databaseId` (string) database id
* `host` (string) database host
* `masterKey` (string) database master key
* `idProperty` (string, optional) the `id` property of the data, defaults to `'id'`

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

#### `coll.query(q, opts, cb)`

A simplified query mechanism that builds a sql query based on properties of `q`. If you want more control use `.sqlquery()` which takes custom query objects.

* `q` object with properties to query for
* `opts` object
* `opts.ORDERBY` order based on this property
* `opts.SORTBY` sort by ascending (`'ASC'`) or descending (`'DESC'`), default is `'ASC'`
* `opts.LIMIT` limit the results
* `opts.OFFSET` offset of limited results

Get all documents with the property `foo` set to `'bar'`, limit the results to `10` and offset `10`.

```js
coll.query({ foo: 'bar' }, { LIMIT: 10, OFFSET: 10 }, cb)
```

The query object supports a simple way of quering for multiple values.

Get all documents with `foo` set to `'bar'` _or_ `'baz'` with `ts` less than `1478008742351`.

```js
coll.query({ foo: [ 'bar', 'baz' ], ts: 'lt(1478008742351)' }, cb)
```

Supported operators:

* '=' equality (default)
* '<' less than, `lt(314)`
* '<=' less than or equal, `lte(314)`
* '>' greater than, `gt(314)`
* '>=' greater than or equal, `gte(314)`


#### `coll.sqlquery(query, cb)`

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

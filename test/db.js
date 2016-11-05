const test = require('tape')
const xtend = require('xtend')
const sinon = require('sinon')
const documentdb = require('documentdb')
const DB = require('..')

test('constructor throws if required properties are not set', function (t) {
  t.throws(DB.bind(null), /\.databaseId required/)
  t.throws(DB.bind(null, {}), /\.databaseId required/)
  t.throws(DB.bind(null, {
    databaseId: 'db-id'
  }), /\.host required/)
  t.throws(DB.bind(null, {
    databaseId: 'db-id',
    host: 'https://my-documentdb.documents.azure.com:443/'
  }), /\.masterKey required/)
  t.end()
})

test('throws if queryDatabases() fails', function (t) {
  const expected = new Error('queryDatabases() failed')
  const toArray = sinon.stub().yields(expected)
  const queryDatabases = sinon.stub().returns({ toArray: toArray })
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: queryDatabases
  })
  t.throws(DB.bind(null, getOpts()), /queryDatabases\(\) failed/)
  t.equal(DocumentClient.calledOnce, true)
  t.equal(queryDatabases.calledOnce, true)
  t.equal(toArray.calledOnce, true)
  DocumentClient.restore()
  t.end()
})

test('throws if queryDatabases() returns more than one database', function (t) {
  const toArray = sinon.stub().yields(null, [ {}, {} ])
  const queryDatabases = sinon.stub().returns({ toArray: toArray })
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: queryDatabases
  })
  const opts = getOpts()
  t.throws(DB.bind(null, opts), /more than one database/)
  t.equal(DocumentClient.calledOnce, true)
  t.equal(queryDatabases.calledOnce, true)
  t.same(queryDatabases.getCall(0).args[0], {
    query: 'SELECT * FROM root r WHERE r.id = @id',
    parameters: [ { name: '@id', value: 'db-id' } ]
  })
  t.equal(toArray.calledOnce, true)
  DocumentClient.restore()
  t.end()
})

test('asserts that found db has a _self reference', function (t) {
  const expectedDb = { does: 'not have a _self property' }
  const toArray = sinon.stub().yields(null, [ expectedDb ])
  const queryDatabases = sinon.stub().returns({ toArray: toArray })
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: queryDatabases
  })
  t.throws(DB.bind(null, getOpts()), /db must have a _self reference/)
  t.equal(DocumentClient.calledOnce, true)
  t.equal(queryDatabases.calledOnce, true)
  t.equal(toArray.calledOnce, true)
  DocumentClient.restore()
  t.end()
})

test('returns existing database if one existing was found', function (t) {
  const dummy = { _self: 'aselfpointer' }
  const toArray = sinon.stub().yields(null, [ dummy ])
  const queryDatabases = sinon.stub().returns({ toArray: toArray })
  const queryCollections = sinon.stub().returns({ toArray: toArray })
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: queryDatabases,
    queryCollections: queryCollections
  })
  const db = DB(getOpts())
  t.equal(db.db._self, dummy._self, 'correct _self reference')
  DocumentClient.restore()
  t.end()
})

test('throws error if more than one database was found', function (t) {
  const dummyDb = { _self: 'db-self-pointer' }
  const toArray = sinon.stub().yields(null, [ dummyDb, dummyDb ])
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: toArray })
  })
  t.throws(DB.bind(null, getOpts()), /found more than one database/)
  DocumentClient.restore()
  t.end()
})

test('creates database if no one was found', function (t) {
  const dummyDb = { _self: 'db-self-pointer' }
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: sinon.stub().yields(null, []) }),
    createDatabase: sinon.stub().yields(null, dummyDb)
  })
  const db = DB(getOpts())
  t.equal(db.client.createDatabase.calledOnce, true)
  t.same(db.client.createDatabase.getCall(0).args[0], {
    id: 'db-id'
  }, 'db created with correct id')
  t.same(db.client.createDatabase.getCall(0).args[1], {
    consistencyLevel: 'Strong'
  }, 'strong consistency')
  t.equal(db.db._self, 'db-self-pointer', 'correct _self reference')
  DocumentClient.restore()
  t.end()
})

test('DB emits ready when database is ready', function (t) {
  const dummyDb = { _self: 'db-self-pointer' }
  const toArray = sinon.stub().yieldsAsync(null, [ dummyDb ])
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: toArray })
  })
  DB(getOpts()).on('ready', () => {
    t.pass('ready event fired')
    DocumentClient.restore()
    t.end()
  })
})

test('createCollection() throws if missing collection id', function (t) {
  const dummyDb = { _self: 'db-self-pointer' }
  const toArray = sinon.stub().yieldsAsync(null, [ dummyDb ])
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: toArray })
  })
  const db = DB(getOpts())
  t.throws(db.createCollection.bind(db), /missing collection id/)
  DocumentClient.restore()
  t.end()
})

test('existing collection', function (t) {
  const dummyDb = { _self: 'db-self-pointer' }
  const dummyColl = { _self: 'coll-self-pointer', id: 'dude' }
  const dbToArray = sinon.stub().yieldsAsync(null, [ dummyDb ])
  const collToArray = sinon.stub().yields(null, [ dummyColl ])
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: dbToArray }),
    queryCollections: sinon.stub().returns({ toArray: collToArray }),
    createCollection: sinon.stub()
  })
  const db = DB(getOpts())
  db.on('ready', () => {
    db.createCollection('dude')
    t.equal(db.client.queryCollections.calledOnce, true)
    t.equal(db.client.createCollection.calledOnce, false)
    DocumentClient.restore()
    t.end()
  })
})

test('throws error if more than one collection was found', function (t) {
  const dummyDb = { _self: 'db-self-pointer' }
  const dummyColl = { _self: 'coll-self-pointer', id: 'dude' }
  const dbToArray = sinon.stub().yieldsAsync(null, [ dummyDb ])
  const collToArray = sinon.stub().yields(null, [ dummyColl, dummyColl ])
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: dbToArray }),
    queryCollections: sinon.stub().returns({ toArray: collToArray })
  })
  const db = DB(getOpts())
  db.on('ready', () => {
    t.throws(db.createCollection.bind(db, 'dude'), /found more than one collection/)
    DocumentClient.restore()
    t.end()
  })
})

test('creates collection if no one was found', function (t) {
  const dummyDb = { _self: 'db-self-pointer' }
  const dummyColl = { _self: 'coll-self-pointer' }
  const dbToArray = sinon.stub().yieldsAsync(null, [ dummyDb ])
  const collToArray = sinon.stub().yields(null, [])
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: dbToArray }),
    queryCollections: sinon.stub().returns({ toArray: collToArray }),
    createCollection: sinon.stub().yieldsAsync(null, dummyColl)
  })
  const db = DB(getOpts())
  db.on('ready', () => {
    db.createCollection('dude')
    t.equal(db.client.queryCollections.calledOnce, true)
    t.equal(db.client.createCollection.calledOnce, true)
    t.same(db.client.createCollection.getCall(0).args[0], 'db-self-pointer')
    t.same(db.client.createCollection.getCall(0).args[1], {
      id: 'dude',
      indexingPolicy: {
        automatic: true,
        indexingMode: 'Consistent'
      }
    }, 'correct collection specs')
    t.same(db.client.createCollection.getCall(0).args[2], {
      offerType: 'S1'
    }, 'correct request options')
    DocumentClient.restore()
    t.end()
  })
})

test('.put() throws if missing id property', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    t.throws(m.coll.put.bind(m.coll, { no: 'id is set' }), /\.id must be set/)
    m.DocumentClient.restore()
    t.end()
  })
})

test('.put() throws if id property has length zero', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    t.throws(m.coll.put.bind(m.coll, { id: '' }), /\.id must be of non zero length/)
    m.DocumentClient.restore()
    t.end()
  })
})

test('.put() throws if missing id property, custom id property', function (t) {
  const m = mock({ idProperty: 'YODUDE' })
  m.db.on('ready', () => {
    t.throws(m.coll.put.bind(m.coll, { no: 'id is set' }), /\.YODUDE must be set/)
    m.DocumentClient.restore()
    t.end()
  })
})

test('.put() with custom id property', function (t) {
  const m = mock({ idProperty: 'YODUDE' })
  m.db.on('ready', () => {
    t.doesNotThrow(m.coll.put.bind(m.coll, { YODUDE: 'some id here' }))
    m.DocumentClient.restore()
    t.end()
  })
})

test('.put() wraps createDocument()', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    m.coll.put({ id: 'hereisanid' }, () => {})
    t.equal(m.db.client.createDocument.calledOnce, true)
    t.same(m.db.client.createDocument.getCall(0).args[0], 'coll-self-pointer')
    t.same(m.db.client.createDocument.getCall(0).args[1], {
      data: { id: 'hereisanid' },
      id: 'hereisanid'
    })
    t.equal(typeof m.db.client.createDocument.getCall(0).args[2], 'function', 'cb passed on')
    m.DocumentClient.restore()
    t.end()
  })
})

test('.update() wraps replaceDocument()', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    const data = { some: 'data', id: 'someid' }
    m.coll.update('self', data, () => {})
    t.equal(m.db.client.replaceDocument.calledOnce, true)
    t.same(m.db.client.replaceDocument.getCall(0).args[0], 'self')
    t.same(m.db.client.replaceDocument.getCall(0).args[1], {
      data: data, id: 'someid'
    })
    t.equal(typeof m.db.client.replaceDocument.getCall(0).args[2], 'function', 'cb passed on')
    m.DocumentClient.restore()
    t.end()
  })
})

test('.update() throws if missing id property', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    const data = { some: 'data' }
    t.throws(function () {
      m.coll.update('self', data, () => {})
    }, /\.id must be set/)
    m.DocumentClient.restore()
    t.end()
  })
})

test('.update() throws if id property has length zero', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    const data = { some: 'data', id: '' }
    t.throws(function () {
      m.coll.update('self', data, () => {})
    }, /\.id must be of non zero length/)
    m.DocumentClient.restore()
    t.end()
  })
})

test('.update() throws is missing id property, custom id property', function (t) {
  const m = mock({ idProperty: 'EYEDEE' })
  m.db.on('ready', () => {
    const data = { some: 'data' }
    t.throws(function () {
      m.coll.update('self', data, () => {})
    }, /\.EYEDEE must be set/)
    m.DocumentClient.restore()
    t.end()
  })
})

test('.update() with custom id property', function (t) {
  const m = mock({ idProperty: 'EYEDEE' })
  m.db.on('ready', () => {
    const data = { some: 'data', EYEDEE: 'some id here' }
    t.doesNotThrow(function () {
      m.coll.update('self', data, () => {})
    })
    m.DocumentClient.restore()
    t.end()
  })
})

test('.delete() wraps deleteDocument()', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    m.coll.delete('self', () => {})
    t.equal(m.db.client.deleteDocument.calledOnce, true)
    t.same(m.db.client.deleteDocument.getCall(0).args[0], 'self')
    t.equal(typeof m.db.client.deleteDocument.getCall(0).args[1], 'function', 'cb passed on')
    m.DocumentClient.restore()
    t.end()
  })
})

test('.sqlquery() wraps queryDocuments()', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    const query = {
      query: 'SELECT * FROM root r WHERE r.id = @id',
      parameters: [{ name: '@id', value: 'woohoo' }]
    }
    m.coll.sqlquery(query, () => {})
    t.equal(m.db.client.queryDocuments.calledOnce, true)
    t.same(m.db.client.queryDocuments.getCall(0).args[0], 'coll-self-pointer')
    t.same(m.db.client.queryDocuments.getCall(0).args[1], query, 'cb passed on')
    m.DocumentClient.restore()
    t.end()
  })
})

test('.get() calls .sqlquery()', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    const expectedQuery = {
      query: 'SELECT * FROM root r WHERE r.id = @id',
      parameters: [{ name: '@id', value: 'w00tw00t' }]
    }
    m.coll.sqlquery = sinon.spy()
    m.coll.get('w00tw00t', () => {})
    t.equal(m.coll.sqlquery.calledOnce, true)
    t.same(m.coll.sqlquery.getCall(0).args[0], expectedQuery)
    m.DocumentClient.restore()
    t.end()
  })
})

test('.query() calls .sqlquery()', function (t) {
  const m = mock()
  m.db.on('ready', () => {
    const q = {
      foo: 'bar'
    }
    const opts = {
      LIMIT: 10,
      OFFSET: 10,
      ORDERBY: 'foo',
      SORTBY: 'DESC'
    }
    const expectedQuery = {
      query: `SELECT TOP ${opts.LIMIT + opts.OFFSET} * FROM root r WHERE r.data["foo"] = @foo ORDER BY r.data["foo"] DESC`,
      parameters: [{ name: '@foo', value: 'bar' }]
    }
    m.coll.sqlquery = sinon.spy()
    m.coll.query(q, opts, () => {})
    t.equal(m.coll.sqlquery.calledOnce, true)
    t.same(m.coll.sqlquery.getCall(0).args[0], expectedQuery)
    m.DocumentClient.restore()
    t.end()
  })
})

function mock (extra) {
  const dummyDb = { _self: 'db-self-pointer' }
  const dummyColl = { _self: 'coll-self-pointer' }
  const dbToArray = sinon.stub().yieldsAsync(null, [ dummyDb ])
  const collToArray = sinon.stub().yields(null, [ dummyColl ])
  const docToArray = sinon.stub().yields(null, [])
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: dbToArray }),
    queryCollections: sinon.stub().returns({ toArray: collToArray }),
    queryDocuments: sinon.stub().returns({ toArray: docToArray }),
    createDocument: sinon.spy(),
    replaceDocument: sinon.spy(),
    deleteDocument: sinon.spy()
  })
  const db = DB(xtend(getOpts(), extra))
  const coll = db.createCollection('dude')
  return {
    db: db,
    coll: coll,
    DocumentClient: DocumentClient
  }
}

function getOpts () {
  return {
    databaseId: 'db-id',
    host: 'https://my-documentdb.documents.azure.com:443/',
    masterKey: 'a_master_key'
  }
}

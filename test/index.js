const test = require('tape')
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
  t.throws(DB.bind(null, getOpts()))
  DocumentClient.restore()
  t.end()
})

test('creates database if no one was found', function (t) {
  const dummyDb = { _self: 'db-self-pointer' }
  const toArray = sinon.stub().yields(null, [])
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: toArray }),
    createDatabase: sinon.stub().yields(null, dummyDb)
  })
  const db = DB(getOpts())
  t.equal(db.client.createDatabase.calledOnce, true)
  t.same(db.client.createDatabase.getCall(0).args[0], { id: 'db-id' }, 'db created with correct id')
  t.same(db.client.createDatabase.getCall(0).args[1], { consistencyLevel: 'Strong' }, 'strong consistency')
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

/*
test('creates collection if no one was found', function (t) {
  // TODO check that ready is emitted
  const m = dbMock()
  t.equal(m.db.client.createDatabase.calledOnce, true)
  t.same(m.db.client.createDatabase.getCall(0).args[0], { id: 'db-id' }, 'db created with correct id')
  t.same(m.db.client.createDatabase.getCall(0).args[1], { consistencyLevel: 'Strong' }, 'strong consistency')
  t.equal(m.db.db._self, 'db-self-pointer', 'correct _self reference')
  m.DocumentClient.restore()
  t.end()
})

test('.put() asserts if missing id', function (t) {
  const m = dbMock()
  t.throws(m.db.put.bind(m.db, { no: 'id is set' }), /\.id must be set/)
  m.DocumentClient.restore()
  t.end()
})

test('.put() wraps createDocument()', function (t) {
  const m = dbMock()
  m.db.put({ id: 'hereisanid' }, () => {})
  t.equal(m.db.client.createDocument.calledOnce, true)
  t.same(m.db.client.createDocument.getCall(0).args[0], 'collection-self-pointer')
  t.same(m.db.client.createDocument.getCall(0).args[1], {
    data: { id: 'hereisanid' },
    id: 'hereisanid'
  })
  t.equal(typeof m.db.client.createDocument.getCall(0).args[2], 'function', 'cb passed on')
  m.DocumentClient.restore()
  t.end()
})

test('.update() wraps replaceDocument()', function (t) {
  const m = dbMock()
  const data = { some: 'data', id: 'someid' }
  m.db.update('self', data, () => {})
  t.equal(m.db.client.replaceDocument.calledOnce, true)
  t.same(m.db.client.replaceDocument.getCall(0).args[0], 'self')
  t.same(m.db.client.replaceDocument.getCall(0).args[1], {
    data: data, id: 'someid'
  })
  t.equal(typeof m.db.client.replaceDocument.getCall(0).args[2], 'function', 'cb passed on')
  m.DocumentClient.restore()
  t.end()
})

test('.delete() wraps deleteDocument()', function (t) {
  const m = dbMock()
  m.db.delete('self', () => {})
  t.equal(m.db.client.deleteDocument.calledOnce, true)
  t.same(m.db.client.deleteDocument.getCall(0).args[0], 'self')
  t.equal(typeof m.db.client.deleteDocument.getCall(0).args[1], 'function', 'cb passed on')
  m.DocumentClient.restore()
  t.end()
})

test('.query() wraps queryDocuments()', function (t) {
  const m = dbMock()
  const query = {
    query: 'SELECT * FROM root r WHERE r.id = @id',
    parameters: [{ name: '@id', value: 'woohoo' }]
  }
  m.db.query(query, () => {})
  t.equal(m.db.client.queryDocuments.calledOnce, true)
  t.same(m.db.client.queryDocuments.getCall(0).args[0], 'collection-self-pointer')
  t.same(m.db.client.queryDocuments.getCall(0).args[1], query, 'cb passed on')
  m.DocumentClient.restore()
  t.end()
})

test('.get() calls .query()', function (t) {
  const m = dbMock()
  const expectedQuery = {
    query: 'SELECT * FROM root r WHERE r.id = @id',
    parameters: [{ name: '@id', value: 'w00tw00t' }]
  }
  m.db.query = sinon.spy()
  m.db.get('w00tw00t', () => {})
  t.equal(m.db.query.calledOnce, true)
  t.same(m.db.query.getCall(0).args[0], expectedQuery)
  m.DocumentClient.restore()
  t.end()
})

function dbMock () {
  const dummyDb = { _self: 'db-self-pointer' }
  //const dummyCollection = { _self: 'collection-self-pointer' }
  const toArray = sinon.stub().yields(null, [])
  const DocumentClient = sinon.stub(documentdb, 'DocumentClient').returns({
    queryDatabases: sinon.stub().returns({ toArray: toArray }),
    //queryCollections: sinon.stub().returns({ toArray: toArray }),
    createDatabase: sinon.stub().yields(null, dummyDb)
    //createCollection: sinon.stub().yields(null, dummyCollection),
    //queryDocuments: sinon.stub().returns({ toArray: toArray }),
    //createDocument: sinon.spy(),
    //replaceDocument: sinon.spy(),
    //deleteDocument: sinon.spy()
  })
  return {
    db: DB(getOpts()),
    DocumentClient: DocumentClient
  }
}
*/

function getOpts () {
  return {
    databaseId: 'db-id',
    //collectionId: 'collection-id',
    host: 'https://my-documentdb.documents.azure.com:443/',
    masterKey: 'a_master_key'
  }
}

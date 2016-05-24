'use strict'

// http://azure.github.io/azure-documentdb-node/DocumentClient.html

const documentdb = require('documentdb')
const ConsistencyLevel = documentdb.DocumentBase.ConsistencyLevel
const EventEmitter = require('events').EventEmitter
const assert = require('assert')
const inherits = require('inherits')

function DocumentDB (opts) {
  if (!(this instanceof DocumentDB)) {
    return new DocumentDB(opts)
  }

  opts = opts || {}

  assert(opts.databaseId, '.databaseId required')
  assert(opts.collectionId, '.collectionId required')
  assert(opts.host, '.host required')
  assert(opts.masterKey, '.masterKey required')

  const auth = { masterKey: opts.masterKey }
  const policy = new documentdb.DocumentBase.ConnectionPolicy()

  this.client = new documentdb.DocumentClient(opts.host, auth, policy,
                                              ConsistencyLevel.Strong)

  createDatabase.call(this, opts.databaseId, (err, db) => {
    if (err) throw err
    this.db = db
    assert(this.db._self, 'db must have a _self reference')
    createCollection.call(this, opts.collectionId, (err, coll) => {
      if (err) throw err
      this.coll = coll
      assert(this.coll._self, 'collection must have a _self reference')
      this.emit('ready')
    })
  })
}

inherits(DocumentDB, EventEmitter)

function createDatabase (id, cb) {
  const query = createQueryById(id)
  this.client.queryDatabases(query).toArray((err, result) => {
    if (err) return cb(err)
    if (Array.isArray(result)) {
      assert.equal(result.length, 1, 'more than one database')
      return cb(null, result[0])
    }
    const body = { id: id }
    const requestOptions = { consistencyLevel: ConsistencyLevel.Strong }
    this.client.createDatabase(body, requestOptions, cb)
  })
}

function createCollection (id, cb) {
  const query = createQueryById(id)
  const dbSelf = this.db._self
  this.client.queryCollections(dbSelf, query).toArray((err, result) => {
    if (err) return cb(err)
    result = Array.isArray(result) ? result : []
    if (result.length === 1) {
      return cb(null, result[0])
    } else if (result.length === 0) {
      const collectionSpec = {
        id: id,
        indexingPolicy: {
          automatic: true,
          indexingMode: 'Consistent'
        }
      }
      const requestOptions = { offerType: 'S1' }
      return this.client.createCollection(dbSelf, collectionSpec, requestOptions, cb)
    } else {
      assert(false, 'more than one collection')
    }
  })
}

DocumentDB.prototype.put = function (data, cb) {
  assert(typeof data.id === 'string', '.id must be set')
  this.client.createDocument(this.coll._self, { data: data, id: data.id }, cb)
}

DocumentDB.prototype.get = function (id, cb) {
  const query = createQueryById(id)
  this.query(query, function (err, result) {
    if (err) return cb(err)
    if (result.length === 0) {
      let err = new Error('Did not find document')
      err.notFound = true
      return cb(err)
    }
    assert.equal(result.length, 1, 'should have one element')
    cb(null, result[0])
  })
}

DocumentDB.prototype.update = function (self, data, cb) {
  this.client.replaceDocument(self, { data: data }, cb)
}

DocumentDB.prototype.delete = function (self, cb) {
  this.client.deleteDocument(self, cb)
}

DocumentDB.prototype.query = function (query, cb) {
  this.client.queryDocuments(this.coll._self, query)
    .toArray(function (err, result) {
      if (err) return cb(err)
      assert(Array.isArray(result), 'should be an array')
      cb(null, result)
    })
}

function createQueryById (id) {
  return {
    query: 'SELECT * FROM root r WHERE r.id = @id',
    parameters: [{ name: '@id', value: id }]
  }
}

module.exports = DocumentDB

'use strict'

// http://azure.github.io/azure-documentdb-node/DocumentClient.html

const documentdb = require('documentdb')
const ConsistencyLevel = documentdb.DocumentBase.ConsistencyLevel
const EventEmitter = require('events').EventEmitter
const assert = require('assert')
const inherits = require('inherits')
const debug = require('debug')('documentdb-client')

function DB (opts) {
  if (!(this instanceof DB)) {
    return new DB(opts)
  }

  opts = opts || {}

  assert(opts.databaseId, '.databaseId required')
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
    this.emit('ready')
  })
}

inherits(DB, EventEmitter)

DB.prototype.update = function (self, data, cb) {
  assert(typeof data.id === 'string', '.id must be set')
  this.client.replaceDocument(self, { data: data, id: data.id }, cb)
}

DB.prototype.delete = function (self, cb) {
  this.client.deleteDocument(self, cb)
}

function createDatabase (id, cb) {
  const query = createQueryById(id)
  this.client.queryDatabases(query).toArray((err, result) => {
    if (err) return cb(err)
    result = Array.isArray(result) ? result : []
    if (result.length === 1) {
      debug('found existing db')
      return cb(null, result[0])
    } else if (result.length === 0) {
      const body = { id: id }
      const requestOptions = { consistencyLevel: ConsistencyLevel.Strong }
      debug('creating new db')
      this.client.createDatabase(body, requestOptions, cb)
    } else {
      cb(new Error('more than one database'))
    }
  })
}

DB.prototype.createCollection = function (id) {
  assert(typeof id === 'string' && id.length > 0, 'missing collection id')
  return new Collection(this, id)
}

function Collection (DB, id) {
  this.DB = DB
  this.id = id

  const create = () => {
    createCollection.call(this, id, (err, coll) => {
      if (err) throw err
      this.coll = coll
      assert(this.coll._self, 'collection must have a _self reference')
      this.emit('ready')
    })
  }

  if (this.DB.db) {
    debug('creating collection: db set')
    create()
  } else {
    debug('creating collection: once db ready')
    this.DB.once('ready', create)
  }
}

inherits(Collection, EventEmitter)

function createCollection (id, cb) {
  assert(this.DB.db, '.db should be set')

  const query = createQueryById(id)
  const dbSelf = this.DB.db._self
  this.DB.client.queryCollections(dbSelf, query).toArray((err, result) => {
    if (err) return cb(err)
    result = Array.isArray(result) ? result : []
    if (result.length === 1) {
      debug('found existing collection %s', id)
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
      debug('creating collection %s', id)
      this.DB.client.createCollection(dbSelf, collectionSpec, requestOptions, cb)
    } else {
      cb(new Error('more than one collection'))
    }
  })
}

Collection.prototype.put = function (data, cb) {
  if (typeof this.coll === 'undefined') {
    return this.once('ready', this.put.bind(this, data, cb))
  }
  assert(typeof data.id === 'string', '.id must be set')
  assert(typeof this.coll !== 'undefined', 'collection should be set')
  this.DB.client.createDocument(this.coll._self, { data: data, id: data.id }, cb)
}

Collection.prototype.get = function (id, cb) {
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

Collection.prototype.update = function (self, data, cb) {
  this.DB.update(self, data, cb)
}

Collection.prototype.delete = function (self, cb) {
  this.DB.delete(self, cb)
}

Collection.prototype.query = function (query, cb) {
  if (typeof this.coll === 'undefined') {
    return this.once('ready', this.query.bind(this, query, cb))
  }
  assert(typeof this.coll !== 'undefined', 'collection should be set')
  this.DB.client.queryDocuments(this.coll._self, query)
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

module.exports = DB

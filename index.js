'use strict'

// http://azure.github.io/azure-documentdb-node/DocumentClient.html

const documentdb = require('documentdb')
const ConsistencyLevel = documentdb.DocumentBase.ConsistencyLevel
const EventEmitter = require('events').EventEmitter
const assert = require('assert')
const inherits = require('inherits')
const debug = require('debug')('documentdb-client')

const util = require('./util')

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
  this.idProperty = opts.idProperty || 'id'

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

function createDatabase (id, cb) {
  const query = queryByProperty('id', id)
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
      cb(new Error('found more than one database'))
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

  const dbSelf = this.DB.db._self
  const query = queryByProperty('id', id)
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
      cb(new Error('found more than one collection'))
    }
  })
}

Collection.prototype.get = function (id, cb) {
  const query = queryByProperty(this.DB.idProperty, id)
  this.sqlquery(query, (err, result) => {
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

Collection.prototype.put = function (id, data, cb) {
  if (typeof this.coll === 'undefined') {
    return this.once('ready', this.put.bind(this, id, data, cb))
  }
  assert(typeof this.coll !== 'undefined', 'collection should be set')
  const idProperty = this.DB.idProperty
  if (data._self) {
    assert.equal(id, data[idProperty], 'key does not match in document')
    this.DB.client.replaceDocument(data._self, data, cb)
  } else {
    data[idProperty] = id
    this.DB.client.createDocument(this.coll._self, data, cb)
  }
}

Collection.prototype.delete = function (id, cb) {
  this.get(id, (err, result) => {
    if (err) return cb(err)
    assert(result._self, 'should have _self set')
    this.DB.client.deleteDocument(result._self, cb)
  })
}

Collection.prototype.query = function (q, opts, cb) {
  const query = util.buildQuery(q, opts)
  this.sqlquery(query, (err, result) => {
    if (err) return cb(err)
    const offset = util.getOffset(opts)
    if (offset < result.length) {
      cb(null, result.slice(offset))
    } else {
      cb(null, result)
    }
  })
}

Collection.prototype.sqlquery = function (query, cb) {
  if (typeof this.coll === 'undefined') {
    return this.once('ready', this.sqlquery.bind(this, query, cb))
  }
  assert(typeof this.coll !== 'undefined', 'collection should be set')
  this.DB.client.queryDocuments(this.coll._self, query)
    .toArray((err, result) => {
      if (err) return cb(err)
      assert(Array.isArray(result), 'should be an array')
      cb(null, result)
    })
}

function queryByProperty (idProperty, value) {
  const prop = util.keyify(idProperty)
  return {
    query: `SELECT * FROM root r WHERE r${prop} = @id`,
    parameters: [{ name: '@id', value: value }]
  }
}

module.exports = DB

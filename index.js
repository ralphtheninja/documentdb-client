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

DB.prototype.update = function (self, data, cb) {
  const id = this.idProperty
  assert(typeof data[id] === 'string', '.' + id + ' must be set')
  assert(data[id].length > 0, '.' + id + ' must be of non zero length')
  this.client.replaceDocument(self, { data: data, id: data[id] }, cb)
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
      cb(new Error('found more than one collection'))
    }
  })
}

Collection.prototype.put = function (data, cb) {
  if (typeof this.coll === 'undefined') {
    return this.once('ready', this.put.bind(this, data, cb))
  }
  const id = this.DB.idProperty
  assert(typeof data[id] === 'string', '.' + id + ' must be set')
  assert(data[id].length > 0, '.' + id + ' must be of non zero length')
  assert(typeof this.coll !== 'undefined', 'collection should be set')
  this.DB.client.createDocument(this.coll._self, { data: data, id: data[id] }, cb)
}

Collection.prototype.get = function (id, cb) {
  const query = createQueryById(id)
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

Collection.prototype.update = function (self, data, cb) {
  this.DB.update(self, data, cb)
}

Collection.prototype.delete = function (self, cb) {
  this.DB.delete(self, cb)
}

Collection.prototype.query = function (q, opts, cb) {
  const limit = getLimit(opts)
  const query = { query: `SELECT ${limit}* FROM root r` }

  if (Object.keys(q).length > 0) {
    query.query += ' WHERE'
    query.parameters = []
    Object.keys(q).forEach((key, index) => {
      const KEY = keyify(key)
      const value = q[key]
      if (index !== 0) query.query += ' AND'
      const identifier = key.replace(/\./g, '')
      query.query += ` r.data${KEY} = @${identifier}`
      query.parameters.push({ name: `@${identifier}`, value: value })
    })
  }

  const ORDERBY = opts.ORDERBY
  if (typeof ORDERBY === 'string' && ORDERBY.length > 0) {
    const orderby = keyify(ORDERBY)
    query.query += ` ORDER BY r.data${orderby}`
    const sortby = opts.SORTBY
    if (sortby === 'ASC' || sortby === 'DESC') {
      query.query += ` ${sortby}`
    }
  }

  this.sqlquery(query, (err, result) => {
    if (err) return cb(err)
    const offset = opts.OFFSET
    if (typeof offset === 'number' && offset < result.length) {
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

function createQueryById (id) {
  return {
    query: 'SELECT * FROM root r WHERE r.id = @id',
    parameters: [{ name: '@id', value: id }]
  }
}

/**
 * Returns TOP string based on LIMIT and OFFSET
 */
function getLimit (params) {
  let top = 0
  const limit = params.LIMIT
  if (typeof limit === 'number') top += limit
  const offset = params.OFFSET
  if (typeof offset === 'number') top += offset
  return (top > 0 ? `TOP ${top} ` : '')
}

/**
 * Transforms a.b.c to ["a"]["b"]["c"].
 * We need to do this because 'data.Value' is invalid because 'Value' is
 * reserved so it must be transformed to ["data"]["Value"]
 */
function keyify (key) {
  return key.split('.').map(i => '["' + i + '"]').join('')
}

module.exports = DB

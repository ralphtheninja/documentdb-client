'use strict'

const lowerCase = require('lowercase-keys')

function buildQuery (params, OPTS) {
  const opts = lowerCase(OPTS || {})

  const limit = getLimit(opts)
  const query = [ `SELECT ${limit}* FROM root r` ]
  let parameters = []

  if (Object.keys(params).length > 0) {
    query.push('WHERE')
    let conditions = []
    Object.keys(params).forEach(key => {
      let sub = subQuery(key, params[key])
      conditions.push(sub.conditions)
      parameters = parameters.concat(sub.parameters)
    })
    query.push(conditions.join(' AND '))
  }

  const ORDERBY = opts.orderby
  if (typeof ORDERBY === 'string' && ORDERBY.length > 0) {
    const orderby = keyify(ORDERBY)
    query.push(`ORDER BY r${orderby}`)
    const sortby = typeof opts.sortby === 'string' ? opts.sortby.toLowerCase() : ''
    if (sortby === 'asc' || sortby === 'desc') {
      query.push(`${sortby.toUpperCase()}`)
    }
  }

  return {
    query: query.join(' '),
    parameters: parameters
  }
}

function subQuery (key, value) {
  const KEY = keyify(key)

  if (!Array.isArray(value)) {
    let identifier = `${key.replace(/\./g, '')}`
    let parsed = parseValue(value)
    return {
      conditions: `r${KEY} ${parsed.op} @${identifier}`,
      parameters: [ { name: `@${identifier}`, value: parsed.value } ]
    }
  }

  const conditions = []
  const parameters = []
  let conjunction = getConjunction(value)

  value.forEach((value, j) => {
    let identifier = `${key.replace(/\./g, '')}_${j}`
    let parsed = parseValue(value)
    conditions.push(`r${KEY} ${parsed.op} @${identifier}`)
    parameters.push({ name: `@${identifier}`, value: parsed.value })
  })

  return {
    conditions: `(${conditions.join(` ${conjunction} `)})`,
    parameters: parameters
  }
}

/**
 * Transforms a.b.c to ["a"]["b"]["c"].
 * We need to do this because 'data.Value' is invalid because 'Value' is
 * reserved so it must be transformed to ["data"]["Value"]
 */
function keyify (key) {
  return key.split('.').map(i => '["' + i + '"]').join('')
}

/**
 * Returns TOP string based on limit and offset
 */
function getLimit (opts) {
  let top = 0
  if (opts.limit) top += Number(opts.limit)
  top += getOffset(opts)
  return (top > 0 ? `TOP ${top} ` : '')
}

function getOffset (params) {
  return params.offset ? Number(params.offset) : 0
}

/**
 * Returns 'OR' if all values are using '=' for comparison, otherwise 'AND'
 */
function getConjunction (values) {
  for (let i = 0; i < values.length; ++i) {
    let parsed = parseValue(values[i])
    if (parsed.op !== '=') return 'AND'
  }
  return 'OR'
}

function parseValue (value) {
  if (typeof value === 'string') {
    let lt = value.match(/^lt\((\d+)\)/i)
    if (lt) return { op: '<', value: Number(lt[1]) }
    let lte = value.match(/^lte\((\d+)\)/i)
    if (lte) return { op: '<=', value: Number(lte[1]) }
    let gt = value.match(/^gt\((\d+)\)/i)
    if (gt) return { op: '>', value: Number(gt[1]) }
    let gte = value.match(/^gte\((\d+)\)/i)
    if (gte) return { op: '>=', value: Number(gte[1]) }
  }
  return { op: '=', value: value }
}

exports.buildQuery = buildQuery
exports.keyify = keyify
exports.getOffset = getOffset

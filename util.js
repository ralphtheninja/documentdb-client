function buildQuery (q, opts) {
  opts = opts || {}

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

  return query
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
 * Returns TOP string based on LIMIT and OFFSET
 */
function getLimit (params) {
  let top = 0
  if (params.LIMIT) top += Number(params.LIMIT)
  top += getOffset(params)
  return (top > 0 ? `TOP ${top} ` : '')
}

function getOffset (params) {
  return params.OFFSET ? Number(params.OFFSET) : 0
}

exports.buildQuery = buildQuery
exports.keyify = keyify
exports.getOffset = getOffset

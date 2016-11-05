const test = require('tape')
const buildQuery = require('../util').buildQuery

test('queries', t => {
  t.same(buildQuery({
    foo: 'bar'
  }), {
    query: 'SELECT * FROM root r WHERE r.data["foo"] = @foo',
    parameters: [
      { name: '@foo', value: 'bar' }
    ]
  }, 'property equality')
  t.same(buildQuery({
    foo: false,
    bar: true
  }), {
    query: 'SELECT * FROM root r WHERE r.data["foo"] = @foo AND r.data["bar"] = @bar',
    parameters: [
      { name: '@foo', value: false },
      { name: '@bar', value: true }
    ]
  }, 'test booleans')
  t.same(buildQuery({
    'a.b.c': 'baz'
  }), {
    query: 'SELECT * FROM root r WHERE r.data["a"]["b"]["c"] = @abc',
    parameters: [
      { name: '@abc', value: 'baz' }
    ]
  }, 'nested property and equality')
  t.same(buildQuery({
    foo: 'bar',
    'a.b.c': 'baz'
  }), {
    query: 'SELECT * FROM root r WHERE r.data["foo"] = @foo AND r.data["a"]["b"]["c"] = @abc',
    parameters: [
      { name: '@foo', value: 'bar' },
      { name: '@abc', value: 'baz' }
    ]
  }, 'AND')
  t.same(buildQuery({
    foo: 'bar'
  }, { LIMIT: 10 }), {
    query: 'SELECT TOP 10 * FROM root r WHERE r.data["foo"] = @foo',
    parameters: [
      { name: '@foo', value: 'bar' }
    ]
  }, 'LIMIT')
  t.same(buildQuery({
    foo: 'bar'
  }, { ORDERBY: 'foo' }), {
    query: 'SELECT * FROM root r WHERE r.data["foo"] = @foo ORDER BY r.data["foo"]',
    parameters: [
      { name: '@foo', value: 'bar' }
    ]
  }, 'ORDERBY')
  t.same(buildQuery({
    foo: 'bar'
  }, { SORTBY: 'ASC' }), {
    query: 'SELECT * FROM root r WHERE r.data["foo"] = @foo',
    parameters: [
      { name: '@foo', value: 'bar' }
    ]
  }, 'SORTBY ASC (not applied since ORDERBY is missing)')
  t.same(buildQuery({
    foo: 'bar'
  }, { ORDERBY: 'foo', SORTBY: 'ASC' }), {
    query: 'SELECT * FROM root r WHERE r.data["foo"] = @foo ORDER BY r.data["foo"] ASC',
    parameters: [
      { name: '@foo', value: 'bar' }
    ]
  }, 'SORTBY ASC')
  t.same(buildQuery({
    foo: 'bar'
  }, { ORDERBY: 'foo', SORTBY: 'DESC' }), {
    query: 'SELECT * FROM root r WHERE r.data["foo"] = @foo ORDER BY r.data["foo"] DESC',
    parameters: [
      { name: '@foo', value: 'bar' }
    ]
  }, 'SORTBY DESC')
  t.same(buildQuery({
    foo: 'bar'
  }, { ORDERBY: 'foo', SORTBY: 'invalid' }), {
    query: 'SELECT * FROM root r WHERE r.data["foo"] = @foo ORDER BY r.data["foo"]',
    parameters: [
      { name: '@foo', value: 'bar' }
    ]
  }, 'invalid SORTBY')
  t.same(buildQuery({
    foo: [ 'bar', 'baz' ]
  }), {
    query: 'SELECT * FROM root r WHERE (r.data["foo"] = @foo_0 OR r.data["foo"] = @foo_1)',
    parameters: [
      { name: '@foo_0', value: 'bar' },
      { name: '@foo_1', value: 'baz' }
    ]
  }, 'multiple values')
  t.same(buildQuery({
    ts: [ 'gt(314)', 'lt(666)' ]
  }), {
    query: 'SELECT * FROM root r WHERE (r.data["ts"] > @ts_0 AND r.data["ts"] < @ts_1)',
    parameters: [
      { name: '@ts_0', value: 314 },
      { name: '@ts_1', value: 666 }
    ]
  }, 'lt and gt')
  t.same(buildQuery({
    ts: [ 'gte(314)', 'lte(666)' ]
  }), {
    query: 'SELECT * FROM root r WHERE (r.data["ts"] >= @ts_0 AND r.data["ts"] <= @ts_1)',
    parameters: [
      { name: '@ts_0', value: 314 },
      { name: '@ts_1', value: 666 }
    ]
  }, 'lte and gte')
  t.end()
})

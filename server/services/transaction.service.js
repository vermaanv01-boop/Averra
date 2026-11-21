const { AsyncLocalStorage } = require('async_hooks')
const mongoose = require('mongoose')
const config = require('../config/env')
const logger = require('../utils/logger')

const storage = new AsyncLocalStorage()
let transactionsSupported = null

const detectTransactions = async () => {
  if (transactionsSupported !== null) return transactionsSupported
  if (config.database.transactionsDisabled || mongoose.connection.readyState !== 1) {
    transactionsSupported = false
    return false
  }

  const session = await mongoose.startSession()
  try {
    session.startTransaction()
    await mongoose.connection.db.admin().command({ ping: 1 }, { session })
    await session.commitTransaction()
    transactionsSupported = true
  } catch (error) {
    if (/Transaction numbers are only allowed/i.test(error.message)) {
      transactionsSupported = false
    } else {
      transactionsSupported = false
      logger.warn('MongoDB transactions unavailable', { error: error.message })
    }
  } finally {
    await session.endSession()
  }

  if (!transactionsSupported) {
    logger.warn('MongoDB transactions are unavailable; using non-transactional fallback')
  }
  return transactionsSupported
}

const runHooks = async (store) => {
  const hooks = store.afterCommit.splice(0)
  for (const hook of hooks) {
    try {
      await hook()
    } catch (error) {
      logger.error('Post-commit hook failed', { error: error.message })
    }
  }
}

const withDbTransaction = async (callback) => {
  const current = storage.getStore()
  if (current) return callback(current.session)

  const store = { session: null, afterCommit: [] }
  const supported = await detectTransactions()

  if (!supported) {
    return storage.run(store, async () => {
      try {
        const result = await callback(null)
        await runHooks(store)
        return result
      } catch (error) {
        store.afterCommit.length = 0
        throw error
      }
    })
  }

  const session = await mongoose.startSession()
  store.session = session

  try {
    let result
    await session.withTransaction(
      async () => {
        result = await callback(session)
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }
    )
    await runHooks(store)
    return result
  } catch (error) {
    store.afterCommit.length = 0
    throw error
  } finally {
    await session.endSession()
  }
}

const afterCommit = (hook) => {
  const store = storage.getStore()
  if (!store) return Promise.resolve().then(hook)
  store.afterCommit.push(hook)
}

const sessionOf = () => storage.getStore()?.session || null

const withSession = (query, session = sessionOf()) => (session ? query.session(session) : query)

const createWithSession = (Model, doc, session = sessionOf()) =>
  Model.create(doc, session ? { session } : {})

module.exports = {
  withDbTransaction,
  afterCommit,
  sessionOf,
  withSession,
  createWithSession,
  isTransactionsSupported: detectTransactions
}

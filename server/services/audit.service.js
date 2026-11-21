const AuditLog = require('../models/AuditLog')
const { buildPagination } = require('../utils/pagination')

const toAuditDto = (entry) => ({
  id: entry._id.toString(),
  actor: entry.actor?._id
    ? {
        id: entry.actor._id.toString(),
        name: entry.actor.name,
        username: entry.actor.username
      }
    : entry.actor?.toString() || null,
  action: entry.action,
  target: {
    type: entry.target.type,
    id: entry.target.id.toString()
  },
  reason: entry.reason || '',
  metadata: entry.metadata || {},
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
})

const record = async ({ actorId, action, targetType, targetId, reason = '', metadata = {} }) => {
  const entry = await AuditLog.create({
    actor: actorId,
    action,
    target: { type: targetType, id: targetId },
    reason,
    metadata
  })
  return toAuditDto(entry)
}

const list = async ({ page, limit, action, targetType }) => {
  const filter = {}
  if (action) filter.action = action
  if (targetType) filter['target.type'] = targetType

  const skip = (page - 1) * limit
  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'name username')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter)
  ])

  return {
    auditLogs: entries.map(toAuditDto),
    pagination: buildPagination(page, limit, total)
  }
}

module.exports = { record, list, toAuditDto }

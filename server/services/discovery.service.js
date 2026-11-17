const Skill = require('../models/Skill')
const User = require('../models/User')
const { buildPagination } = require('../utils/pagination')

const sortOptions = {
  recent: { createdAt: -1 },
  name: { name: 1 },
  username: { username: 1 },
  skills: { skillCount: -1, username: 1 }
}

const searchUsers = async (query) => {
  const match = { type: query.type }

  if (query.skill) {
    match.normalizedName = query.skill.trim().toLowerCase()
  }
  if (query.category) {
    match.category = query.category
  }
  if (query.proficiency) {
    match.proficiency = query.proficiency
  }

  const skip = (query.page - 1) * query.limit

  const [result] = await Skill.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$user',
        skills: {
          $push: {
            id: '$_id',
            name: '$name',
            category: '$category',
            proficiency: '$proficiency',
            type: '$type'
          }
        },
        skillCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    { $sort: sortOptions[query.sort] },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: query.limit },
          {
            $project: {
              _id: 0,
              id: '$user._id',
              name: '$user.name',
              username: '$user.username',
              profileImage: '$user.profileImage',
              bio: '$user.bio',
              location: '$user.location',
              interests: '$user.interests',
              skillCount: 1,
              skills: 1
            }
          }
        ],
        count: [{ $count: 'total' }]
      }
    }
  ])

  const total = result.count[0]?.total || 0

  return {
    items: result.items,
    pagination: buildPagination(query.page, query.limit, total)
  }
}

const toSkillSummary = (skill) => ({
  id: skill._id,
  name: skill.name,
  category: skill.category,
  proficiency: skill.proficiency
})

const findMatches = async (userId, query) => {
  const ownSkills = await Skill.find({ user: userId })
    .select('name normalizedName category type proficiency')
    .lean()

  const wantedNames = [
    ...new Set(ownSkills.filter((skill) => skill.type === 'learn').map((s) => s.normalizedName))
  ]
  const offeredNames = [
    ...new Set(ownSkills.filter((skill) => skill.type === 'teach').map((s) => s.normalizedName))
  ]

  if (!wantedNames.length) {
    return { items: [], pagination: buildPagination(query.page, query.limit, 0) }
  }

  const candidateFilter = {
    type: 'teach',
    normalizedName: { $in: wantedNames },
    user: { $ne: userId }
  }

  if (query.category) {
    candidateFilter.category = query.category
  }

  const candidateSkills = await Skill.find(candidateFilter).lean()
  const grouped = new Map()

  for (const skill of candidateSkills) {
    const ownerId = skill.user.toString()
    if (!grouped.has(ownerId)) {
      grouped.set(ownerId, [])
    }
    grouped.get(ownerId).push(skill)
  }

  const candidateIds = [...grouped.keys()]
  const [users, reciprocalSkills] = await Promise.all([
    User.find({ _id: { $in: candidateIds } })
      .select('name username profileImage bio location interests')
      .lean(),
    Skill.find({
      user: { $in: candidateIds },
      type: 'learn',
      normalizedName: { $in: offeredNames }
    })
      .select('name normalizedName category proficiency user')
      .lean()
  ])

  const usersById = new Map(users.map((user) => [user._id.toString(), user]))
  const reciprocalByUser = new Map()

  for (const skill of reciprocalSkills) {
    const ownerId = skill.user.toString()
    if (!reciprocalByUser.has(ownerId)) {
      reciprocalByUser.set(ownerId, [])
    }
    reciprocalByUser.get(ownerId).push(skill)
  }

  const items = []

  for (const [ownerId, teaches] of grouped) {
    const user = usersById.get(ownerId)
    if (!user) {
      continue
    }

    const wantsYouTeach = reciprocalByUser.get(ownerId) || []
    const teachesYouWant = teaches.map(toSkillSummary)

    items.push({
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        profileImage: user.profileImage,
        bio: user.bio,
        location: user.location,
        interests: user.interests
      },
      complementary: wantsYouTeach.length > 0,
      teachesYouWant,
      wantsYouTeach: wantsYouTeach.map(toSkillSummary),
      matchCount: teachesYouWant.length
    })
  }

  items.sort((a, b) =>
    Number(b.complementary) - Number(a.complementary) ||
    b.matchCount - a.matchCount ||
    a.user.username.localeCompare(b.user.username)
  )

  const skip = (query.page - 1) * query.limit
  const paginatedItems = items.slice(skip, skip + query.limit)

  return {
    items: paginatedItems,
    pagination: buildPagination(query.page, query.limit, items.length)
  }
}

module.exports = { searchUsers, findMatches }

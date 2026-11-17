const Skill = require('../models/Skill')
const AppError = require('../utils/AppError')

const normalizeName = (name) => name.trim().toLowerCase()

const toSkillDto = (skill) => ({
  id: skill._id.toString(),
  name: skill.name,
  category: skill.category,
  type: skill.type,
  proficiency: skill.proficiency,
  experience: skill.experience,
  createdAt: skill.createdAt,
  updatedAt: skill.updatedAt
})

const listByUser = async (userId) => {
  const skills = await Skill.find({ user: userId }).sort({ createdAt: -1 }).lean()
  return skills.map(toSkillDto)
}

const getOwnedSkill = async (userId, skillId) => {
  const skill = await Skill.findOne({ _id: skillId, user: userId })

  if (!skill) {
    throw new AppError('Skill not found', 404)
  }

  return skill
}

const getTeachSkill = async (userId, skillId) => {
  const skill = await Skill.findOne({ _id: skillId, user: userId, type: 'teach' })

  if (!skill) {
    throw new AppError('Teach skill not found', 404)
  }

  return skill
}

const create = async (userId, data) => {
  const normalizedName = normalizeName(data.name)
  const duplicate = await Skill.exists({ user: userId, normalizedName, type: data.type })

  if (duplicate) {
    throw new AppError('This skill already exists for this type', 409)
  }

  try {
    return await Skill.create({ ...data, user: userId, normalizedName })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('This skill already exists for this type', 409)
    }
    throw error
  }
}

const update = async (userId, skillId, updates) => {
  const skill = await getOwnedSkill(userId, skillId)
  const nextName = updates.name ? normalizeName(updates.name) : skill.normalizedName
  const nextType = updates.type || skill.type
  const changes = { ...updates }

  if (nextName !== skill.normalizedName || nextType !== skill.type) {
    const duplicate = await Skill.exists({
      user: userId,
      normalizedName: nextName,
      type: nextType,
      _id: { $ne: skill._id }
    })

    if (duplicate) {
      throw new AppError('This skill already exists for this type', 409)
    }

    changes.normalizedName = nextName
  }

  Object.assign(skill, changes)

  try {
    await skill.save()
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('This skill already exists for this type', 409)
    }
    throw error
  }

  return skill
}

const remove = async (userId, skillId) => {
  const skill = await Skill.findOneAndDelete({ _id: skillId, user: userId })

  if (!skill) {
    throw new AppError('Skill not found', 404)
  }

  return skill
}

module.exports = { listByUser, getOwnedSkill, getTeachSkill, create, update, remove }

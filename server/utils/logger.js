const log = (level, message) => {
  const entry = `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`

  if (level === 'error') {
    console.error(entry)
  } else if (level === 'warn') {
    console.warn(entry)
  } else {
    console.log(entry)
  }
}

module.exports = {
  info: (message) => log('info', message),
  warn: (message) => log('warn', message),
  error: (message) => log('error', message)
}

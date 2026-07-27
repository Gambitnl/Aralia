export function addDice(base: string, bonus: string, multiplier: number): string {
  const parseMatch = (s: string) => {
    const match = s.match(/(\d+)d(\d+)/)
    return match ? { count: parseInt(match[1]), size: parseInt(match[2]) } : null
  }

  const baseDice = parseMatch(base)
  const bonusDice = parseMatch(bonus)

  if (!baseDice || !bonusDice) return base
  if (baseDice.size !== bonusDice.size) {
    console.warn('Cannot add dice with different sizes')
    return base
  }

  const newCount = baseDice.count + (bonusDice.count * multiplier)
  return `${newCount}d${baseDice.size}`
}

export const bigMath = {
  abs(x: bigint) {
    return x < 0n ? -x : x;
  },
  mulDiv(x: bigint, y: bigint, z: bigint, roundUpMagnitude = false) {
    // 防止除以零错误
    if (z === 0n) {
      console.warn('bigMath.mulDiv: Division by zero detected', { x, y, z });
      return 0n;
    }

    const result = (x * y) / z;

    if (roundUpMagnitude && this.mulmod(x, y, z) > 0n) {
      return result + 1n;
    }

    return result;
  },
  max(max: bigint, ...rest: bigint[]) {
    return rest.reduce((currentMax, val) => (currentMax < val ? val : currentMax), max);
  },
  min(min: bigint, ...rest: bigint[]) {
    return rest.reduce((currentMin, val) => (currentMin > val ? val : currentMin), min);
  },
  avg(...values: (bigint | undefined)[]) {
    let sum = 0n;
    let count = 0n;
    for (const value of values) {
      if (value !== undefined) {
        sum += value;
        count += 1n;
      }
    }

    if (count === 0n) {
      return undefined;
    }

    // count 在这里不可能为 0，因为上面已经检查过
    return sum / count;
  },
  divRound(x: bigint, y: bigint) {
    if (y === 0n) {
      console.warn('bigMath.divRound: Division by zero detected', { x, y });
      return 0n;
    }
    return x / y + ((x % y) * 2n > y ? 1n : 0n);
  },
  divRoundUp(x: bigint, y: bigint) {
    if (y === 0n) {
      console.warn('bigMath.divRoundUp: Division by zero detected', { x, y });
      return 0n;
    }
    return (x + y - 1n) / y;
  },
  mulmod(x: bigint, y: bigint, m: bigint): bigint {
    return (x * y) % m;
  },
  clamp(value: bigint, min: bigint, max: bigint): bigint {
    return bigMath.max(min, bigMath.min(value, max));
  },
};

import { gte, valid } from 'semver';
interface CompareProps {
  major: Map<number, {
    minor: Map<number, {
      patch: Map<number, Set<string>>,
      max: number,
    }>,
    max: number
  }>,
  max: number,
}

function format(version: string) {
  const a = version.indexOf('.');
  const major = Number(version.substring(0, a));
  const b = version.substring(a + 1);
  const c = b.indexOf('.');
  const minor = Number(b.substring(0, c));
  const d = b.substring(c + 1);
  const reg = /^(\d+)(.*?)$/.exec(d);
  const patch = Number(reg[1]);
  const prerelease = reg[2];
  return { major, minor, patch, prerelease }
}

export function versionValid(version: string) {
  return valid(version) !== null;
}

export function versionAllowed(version: string, versions: string[]): [boolean, string?] {
  const root: CompareProps = {
    major: new Map(),
    max: 0
  }
  versions.forEach(ver => {
    const { major, minor, patch, prerelease } = format(ver);
    if (!root.major.has(major)) {
      root.major.set(major, {
        minor: new Map(),
        max: 0
      })
    }
    if (major > root.max) root.max = major;
    const majors = root.major.get(major);
    if (!majors.minor.has(minor)) {
      majors.minor.set(minor, {
        patch: new Map(),
        max: 0
      })
    }
    if (minor > majors.max) majors.max = minor;
    const minors = majors.minor.get(minor);
    if (!minors.patch.has(patch)) {
      minors.patch.set(patch, new Set());
    }
    if (patch > minors.max) minors.max = patch;
    const patchs = minors.patch.get(patch);
    if (!patchs.has(prerelease)) {
      patchs.add(prerelease);
    }
  })
  const { major, minor, patch } = format(version);
  if (root.major.has(major)) {
    const majors = root.major.get(major);
    if (majors.minor.has(minor)) {
      const minors = majors.minor.get(minor);
      if (minors.patch.has(patch)) {
        const patchs = minors.patch.get(patch);
        for (const v of patchs) {
          const p = `${major}.${minor}.${patch}${v}`;
          const s = gte(p, version);
          if (s) return [false, p];
        }
        return [true];
      } else {
        return [minors.max < patch, minors.max >= patch ? `${major}.${minor}.${minors.max}` : undefined];
      }
    } else {
      return [majors.max < minor, majors.max >= minor ? `${major}.${majors.max}.*` : undefined];
    }
  } else {
    return [root.max < major, root.max >= major ? `${root.max}.*.*` : undefined];
  }
}
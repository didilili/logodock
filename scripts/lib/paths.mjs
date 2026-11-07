export function toPosixPath(file) {
  return file.replaceAll('\\', '/');
}

export function isWithinDirectory(file, directory) {
  return toPosixPath(file).startsWith(`${toPosixPath(directory).replace(/\/+$/, '')}/`);
}

const hasExtension = fileName => fileName.includes('.');

const getFileName = fileName =>
  fileName.slice(0, fileName.lastIndexOf('.'));

const getFileExtension = fileName =>
  fileName.slice(fileName.lastIndexOf('.') + 1);

const parseFileName = (file) => {
  const fileName = file.pathToFile[file.pathToFile.length - 1];

  if (hasExtension(fileName)) {
    const name = getFileName(fileName);
    const extName = getFileExtension(fileName);
    return { ...file, file: { name, extName } };
  }

  const name = fileName;
  return { ...file, file: { name } };
};

const splitBySlash = (file) => {
  const pathToFile = file.rawPath.split('/');
  return { ...file, pathToFile };
};

const trim = (file) => {
  const pathToFile = file.pathToFile.map(elem => elem.trim());
  return { ...file, pathToFile };
};

const toLower = (file) => {
  const pathToFile = file.pathToFile.map(elem => elem.toLocaleLowerCase());
  return { ...file, pathToFile };
};

const getPathToDir = (file) => {
  const pathToDir = file.pathToFile.slice(0, -1);
  return { ...file, pathToDir };
};

const funcs = [
  splitBySlash,
  trim,
  toLower,
  getPathToDir,
  parseFileName,
];

const format = rawPath =>
  funcs.reduce((file, func) => {
    if (!file) {
      return false;
    }

    return func(file);
  }, { rawPath });

module.exports = format;

const path = require('path');
const fs = require('fs');

// files - array of file paths
const fetchFilesFromArray = files =>
  files.filter((file) => {
    let stats;
    try {
      stats = fs.statSync(file);
    } catch (err) {
      console.log(err);
      return false;
    }
    return stats.isFile();
  });

// files - array of file paths
const fetchDirsFromArray = files =>
  files.filter((file) => {
    let stats;
    try {
      stats = fs.statSync(file);
    } catch (err) {
      console.log(err);
      return false;
    }
    return stats.isDirectory();
  });

const fetchFilesFromDirRec = (pathToDir) => {
  const contentDir = fs.readdirSync(pathToDir)
    .map(file => path.win32.join(pathToDir, file));   // warning

  const files = fetchFilesFromArray(contentDir)
    .map((pathToFile) => {
      const { name, ext } = path.parse(pathToFile);
      return {
        name: name.toLocaleLowerCase(),
        extName: ext.toLocaleLowerCase().slice(1),
        pathToFile,
      };
    });

  const dirs = fetchDirsFromArray(contentDir);

  if (dirs.length === 0) {
    return files;
  }

  return files.concat(dirs.reduce((acc, dir) => {
    acc.push(...fetchFilesFromDirRec(dir));
    return acc;
  }, []));
};

const cacheStorage = new Map();

const fetchFilesFromDirRecUseCache = (pathToFile, cache) => {
  if (cache.has(pathToFile)) {
    return cache.get(pathToFile);
  }

  const result = fetchFilesFromDirRec(pathToFile);
  cache.set(pathToFile, result);
  setTimeout(() => {
    cache.delete(pathToFile);
  }, 60 * 5 * 1000);
  return result;
};


// options - contains the name and extension of file
// pathToDir
const findFileInDir = (options, pathToDir) => {
  const files = fetchFilesFromDirRecUseCache(pathToDir, cacheStorage);

  let filteredFiles = files.filter(file => file.name === options.name);
  if (options.extName) {
    filteredFiles = filteredFiles.filter(file => file.extName === options.extName);
  }

  return filteredFiles;
};

module.exports.fetchFilesFromArray = fetchFilesFromArray;
module.exports.fetchDirsFromArray = fetchDirsFromArray;
module.exports.fetchFilesFromDirRec = fetchFilesFromDirRec;
module.exports.findFileInDir = findFileInDir;

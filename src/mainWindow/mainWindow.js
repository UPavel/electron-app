const fs = require('fs');
const path = require('path');
const request = require('request');

const Session = require('../session');
const Question = require('../question');
const format = require('../formatFileName');
const { findFileInDir } = require('../findFile');

const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../config.json')));

let session = null;

const makeRequest = ({ method, url, headers = {}, body = {} }, json = false) =>
  new Promise((resolve, reject) => {
    const options = { method, url, headers, ...body };

    request(options, (error, response, resBody) => {
      if (error) {
        reject(error);
      }

      if (json) {
        let resBodyParse;
        try {
          resBodyParse = JSON.parse(resBody);
        } catch (err) {
          reject(err);
        }

        resolve(resBodyParse);
      }

      resolve(resBody);
    });
  });

const requestToBot = async ({ method, pathName, body }, json = false) => {
  const botAddress = `http://${config.botServer.hostName}:${config.botServer.port}`;
  const res = await makeRequest({
    method,
    url: `${botAddress}${pathName}`,
    body: body ? { body } : undefined,
  }, json);

  return res;
};

const getUserIdFromBot = async (code) => {
  console.log('start get id');
  const { id } = await requestToBot({
    method: 'POST',
    pathName: '/id',
    body: JSON.stringify({ code }),
  }, true);

  return id;
};

const longPollToBot = async (userId, data) => {
  const obj = data === undefined ? { userId } : { userId, data };

  const { message } = await requestToBot({
    method: 'POST',
    pathName: '/subscribe',
    body: JSON.stringify(obj),
  }, true);

  return message;
};

const sendPhotoInfoToBot = async (id, ownerId) => {
  const { message } = await requestToBot({
    method: 'POST',
    pathName: '/sendFile',
    body: JSON.stringify({ id, ownerId }),
  }, true);

  return message;
};

const loadPhototoVK = async (pathToPhoto) => {
  const { response: { upload_url: uploadUrl } } = await makeRequest({
    method: 'GET',
    url: 'https://api.vk.com/method/photos.getMessagesUploadServer?access_token=ec2248225b492d490674281d1a8b8aa360106492f7c7b297cd6431ddc2c4b631464fc75bbf2b446a05d01&v=5.63'
  }, true);

  const formData = {
    photo: fs.createReadStream(pathToPhoto),
  };

  const { server, photo, hash } = await makeRequest({
    method: 'POST',
    url: uploadUrl,
    body: { formData },
  }, true);

  const { response: [{ id, owner_id: ownerId }] } = await makeRequest({
    method: 'GET',
    url: `https://api.vk.com/method/photos.saveMessagesPhoto?server=${server}&photo=${photo.toString()}&hash=${hash}&access_token=ec2248225b492d490674281d1a8b8aa360106492f7c7b297cd6431ddc2c4b631464fc75bbf2b446a05d01&v=5.63`,
  }, true);

  return { id, ownerId };
};

const loadFileToVK = async (pathToFile) => {
  const { response: { upload_url: uploadUrl } } = await makeRequest({
    method: 'GET',
    url: `https://api.vk.com/method/docs.getWallUploadServer?group_id=${140444947}&access_token=ec2248225b492d490674281d1a8b8aa360106492f7c7b297cd6431ddc2c4b631464fc75bbf2b446a05d01&v=5.63`
  }, true);

  console.log('uploadUrl');
  console.log(uploadUrl);

  const formData = {
    file: fs.createReadStream(pathToFile),
  };

  const { file } = await makeRequest({
    method: 'POST',
    url: uploadUrl,
    body: { formData },
  }, true);

  console.log('file');
  console.log(file);

  const { response: [{ id, owner_id: ownerId }] } = await makeRequest({
    method: 'GET',
    url: `https://api.vk.com/method/docs.save?file=${file}&access_token=ec2248225b492d490674281d1a8b8aa360106492f7c7b297cd6431ddc2c4b631464fc75bbf2b446a05d01&v=5.63`,
  }, true);

  console.log('id, ownerId');
  console.log(id, ownerId);

  return { id, ownerId };
}

const longPolling = async (userId, responseData) => {
  console.log('LONG POLL');

  let message;
  try {
    message = await longPollToBot(userId, responseData);
  } catch (error) {
    if (error.code === 'ECONNRESET') {
      console.log('timeout');
      return longPolling(userId);
    }

    throw error;
  }
  console.log(`incoming message "${message}"`);

  if (!session) {
    console.log('session started');
    session = new Session();

    const pathToFile = undefined; // history.get(message);
    if (pathToFile && fs.existsSync(pathToFile)) {
      session.setData({ rawQuery: message, pathToFile });
    } else {
      session.setData({ rawQuery: message, formattedRequest: format(message) });
    }
  } else {
    console.log('session continues');
    const question = session.getActualQuestion();
    if (question.verify(message)) {
      session.setData(question.applyResponse(session.getData(), message));
    } else {
      console.log('wrong answer');
      return longPolling(userId, `Неверный ответ\n${question.getText()}`);
    }
  }

  // -------------------- processing an incoming message ---------------------
  let pathToFile;
  if (session.getData().pathToFile) {
    pathToFile = session.getData().pathToFile;
  } else {
    if (session.getData().formattedRequest.pathToDir.length === 0) {
      const textQuestion = 'На каком диске находится файл?';
      const expectedResponse = /^[a-zA-Z]$/;
      const onSuccess = (data, disk) => ({ ...data, formattedRequest: format(`${disk}:/${data.formattedRequest.rawPath}`) });
      const question = new Question(textQuestion, expectedResponse, onSuccess);
      session.addQuestion(question);
      return longPolling(userId, question.getText());
    }

    const { file, pathToDir } = session.getData().formattedRequest;

    const files = findFileInDir(file, path.join(...pathToDir));
    console.log('FILES!!!');
    console.log(files);

    if (files.length > 1) {
      session.addData({ files });
      const textQuestion = ['Какой файл вам нужен?\n', ...files.map((elem, index) => `${index + 1} - ${elem.pathToFile}`)].join('\n');
      const expectedResponse = /^[1-3]$/;
      const onSuccess = (data, number) => {
        const needFile = session.getData().files[parseInt(number, 10) - 1];
        return { ...data, formattedRequest: format(needFile.pathToFile.split('\\').join('/')), pathToFile: needFile.pathToFile };
      };
      const question = new Question(textQuestion, expectedResponse, onSuccess);
      session.addQuestion(question);
      return longPolling(userId, question.getText());
    }

    if (files.length === 1) {
      ([{ pathToFile }] = files);
      session.getData().pathToFile = pathToFile;
    }

    if (files.length === 0) {
      console.log('not such file');
      session = null;
      return longPolling(userId, 'Нет такого файла');
    }
  }

  let id;
  let ownerId;
  try {
    // ({ id, ownerId } = await loadPhototoVK(session.getData().pathToFile));
    ({ id, ownerId } = await loadFileToVK(session.getData().pathToFile));
    console.log('file');
    console.log(id);
    console.log(ownerId);
  } catch (error) {
    console.log(error);
    console.log('failed to upload photo on server VK');
    // надо передать эту информацию боту
    return longPolling(userId);
  }
  console.log('photo uploaded on VK server');

  try {
    await sendPhotoInfoToBot(id, ownerId);
  } catch (error) {
    console.log('id, ownerId is not sent to bot');
    return longPolling(userId);
  }

  console.log('id, ownerId is sent to bot');

  session = null;
  console.log('session ended');

  // -------------------- processing an incoming message ---------------------

  return longPolling(userId);
};

const main = async () => {
  let userId;
  const code = document.getElementById('code').value;

  try {
    userId = await getUserIdFromBot(code);
    console.log(`got user id: ${userId}`);
  } catch (error) {
    console.log(error);
    console.log('failed to get user id');
    return;
  }

  if (!userId) {
    const form = document.getElementById('form');
    const errorTitle = document.createElement('p');
    errorTitle.appendChild(document.createTextNode('Код не верный!'));
    form.appendChild(errorTitle);
    return;
  }

  const container = document.getElementById('container');
  container.removeChild(document.getElementById('form'));

  const successTitle = document.createElement('p');
  successTitle.appendChild(document.createTextNode('Код введён верно!\n Отправьте боту имя файла, который хотите получить.'));
  container.appendChild(successTitle);

  try {
    await longPolling(userId);
  } catch (err) {
    console.log(err);
  }
};

document.getElementById('btn').addEventListener('click', () => main());

import * as detect from 'detect-port';

function pickFreePort(start: number, end: number) {
  return parseInt(String(Math.random() * (end - start))) + start;
}

function checkPort(port: number) {
  return detect(port);
}

export {
  checkPort,
  pickFreePort,
}
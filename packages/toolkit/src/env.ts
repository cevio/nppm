import { networkInterfaces } from 'os';
import * as detect from 'detect-port';

const interfaces = networkInterfaces();

export const localhost = Object.keys(interfaces).map(function(nic) {
  const addresses = interfaces[nic].filter(details => details.family.toLowerCase() === "ipv4" && !isLoopback(details.address));
  return addresses.length ? addresses[0].address : undefined;
}).filter(Boolean)[0];

function isLoopback(addr: string): boolean {
  return (
    /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/.test(addr) ||
    /^fe80::1$/.test(addr) ||
    /^::1$/.test(addr) ||
    /^::$/.test(addr)
  );
}

function pickFreePort(start: number, end: number) {
  return parseInt(String(Math.random() * (end - start))) + start;
}

function checkPort(port: number) {
  return detect(port);
}

export const Port = {
  check: checkPort,
  range: pickFreePort,
}
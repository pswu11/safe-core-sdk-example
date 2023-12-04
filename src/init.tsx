// init.js
// this is a workaround for having undefined global, buffer, and process in the browser
// happens when using vite with web3 related packages
import { Buffer } from 'buffer';
import process from "process";
window.global ||= window;
// @ts-ignore
window.Buffer = Buffer;
window.process = process; 
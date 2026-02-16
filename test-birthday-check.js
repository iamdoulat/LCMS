// Simple test to check if there are birthdays today
// Run with: node test-birthday-check.js

const moment = require('moment-timezone');

const tz = 'Asia/Dhaka';
const todayBD = moment().tz(tz);
const currentMonthDay = todayBD.format('MM-DD');

console.log(`\n=== Birthday Check for ${tz} ===`);
console.log(`Current Date: ${todayBD.format('YYYY-MM-DD HH:mm:ss')}`);
console.log(`Looking for birthdays on: ${currentMonthDay} (month-day format)`);
console.log(`\nIn other words, looking for people born on:`);
console.log(`  - February 16 (any year)`);
console.log(`  - 02-16 or 16-02 or 2026-02-16 format`);

function isNextUsEquitiesSessionOpen_() {
  const todayKey = isoDateKey_(new Date(), NIGHTLY_MARKET_FORECAST.timezone);
  const nextDate = ymdToUtcDate_(todayKey);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextKey = formatUtcDateYmd_(nextDate);
  const open = isUsEquitiesTradingDay_(nextDate);
  return {
    today: todayKey,
    nextSessionDate: nextKey,
    isOpen: open,
    reason: open ? 'next morning is a US equities trading session' : 'weekend or observed US market holiday'
  };
}

function isUsEquitiesTradingDay_(date) {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) {
    return false;
  }
  const closedDays = getUsEquitiesHolidaySet_(date.getUTCFullYear());
  return !closedDays[formatUtcDateYmd_(date)];
}

function getUsEquitiesHolidaySet_(year) {
  const holidayMap = {};
  [
    observedFixedHoliday_(year, 0, 1),
    nthWeekdayOfMonthUtc_(year, 0, 1, 3),
    nthWeekdayOfMonthUtc_(year, 1, 1, 3),
    goodFridayUtc_(year),
    lastWeekdayOfMonthUtc_(year, 4, 1),
    observedFixedHoliday_(year, 5, 19),
    observedFixedHoliday_(year, 6, 4),
    nthWeekdayOfMonthUtc_(year, 8, 1, 1),
    nthWeekdayOfMonthUtc_(year, 10, 4, 4),
    observedFixedHoliday_(year, 11, 25)
  ].forEach(function(date) {
    holidayMap[formatUtcDateYmd_(date)] = true;
  });
  return holidayMap;
}

function observedFixedHoliday_(year, monthIndex, day) {
  const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  const weekday = date.getUTCDay();
  if (weekday === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  } else if (weekday === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

function nthWeekdayOfMonthUtc_(year, monthIndex, weekday, nth) {
  const date = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  date.setUTCDate(date.getUTCDate() + (nth - 1) * 7);
  return date;
}

function lastWeekdayOfMonthUtc_(year, monthIndex, weekday) {
  const date = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0));
  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date;
}

function easterSundayUtc_(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function goodFridayUtc_(year) {
  const easter = easterSundayUtc_(year);
  easter.setUTCDate(easter.getUTCDate() - 2);
  return easter;
}

function ymdToUtcDate_(ymd) {
  const parts = ymd.split('-').map(function(part) { return Number(part); });
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
}

function formatUtcDateYmd_(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return [year, month, day].join('-');
}

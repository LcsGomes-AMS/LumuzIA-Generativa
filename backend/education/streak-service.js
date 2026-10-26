"use strict";
function calendarDate(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function previousDate(today) {
    const day = new Date(`${today}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() - 1);
    return day.toISOString().slice(0, 10);
}
function advanceStreak(row, today) {
    const current = row?.last_activity_date === today ? row.current_streak
        : row?.last_activity_date === previousDate(today) ? row.current_streak + 1 : 1;
    return { current, best: Math.max(row?.best_streak || 0, current) };
}
function visibleStreak(row, today) {
    return row && [today, previousDate(today)].includes(row.last_activity_date) ? row.current_streak : 0;
}
module.exports = { calendarDate, previousDate, advanceStreak, visibleStreak };

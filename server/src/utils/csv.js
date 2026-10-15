/**
 * RFC 4180 CSV helpers with spreadsheet formula-injection protection.
 * Numbers are written as-is (already rounded exactly by the reporting layer); text cells
 * beginning with = + - @ or a control character are prefixed with a single quote.
 */

export function csvCell(value, { decimals = null } = {}) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return decimals === null ? String(value) : value.toFixed(decimals);
  }
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(cells) {
  return cells.join(',');
}

export function toCsv(header, rows) {
  return `﻿${[csvRow(header.map(h => csvCell(h))), ...rows.map(csvRow)].join('\r\n')}\r\n`;
}

export function safeFilenamePart(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) || 'report';
}

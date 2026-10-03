/**
 * 복지인사이트 교육신청 수신기 (Google Apps Script)
 * ------------------------------------------------------------
 * 홈페이지 문의폼 → 이 스크립트(웹앱) → ① 구글 시트에 한 줄 저장
 *                                      ② 담당자 휴대폰으로 문자(SMS/LMS) 알림
 *                                      ③ (선택) 담당자 이메일 알림, 신청자 접수확인 문자
 *
 * 설치 방법은 apps-script/README.md 를 참고하세요.
 *
 * [스크립트 속성] 프로젝트 설정 → 스크립트 속성에 아래 값을 넣습니다.
 *   SOLAPI_API_KEY      솔라피(SOLAPI) API Key
 *   SOLAPI_API_SECRET   솔라피 API Secret
 *   SMS_FROM            솔라피에 등록한 발신번호 (예: 07080193355)
 *   ADMIN_PHONE         알림 받을 휴대폰 번호, 여러 개면 쉼표로 구분 (예: 01012345678)
 *   ADMIN_EMAIL         (선택) 알림 받을 이메일. 비우면 이메일 알림 안 함
 *   NOTIFY_APPLICANT    (선택) true 로 두면 신청자에게도 접수확인 문자 발송
 */

const SHEET_NAME = '신청내역';

// 시트 열 구성 (순서를 바꾸면 기존 데이터와 어긋나니 주의)
const COLUMNS = [
  ['receivedAt', '접수일시'],
  ['status', '처리상태'],
  ['type', '문의유형'],
  ['org', '기관명'],
  ['orgType', '기관유형'],
  ['name', '담당자'],
  ['phone', '연락처'],
  ['email', '이메일'],
  ['target', '교육대상·인원'],
  ['date', '희망일정'],
  ['hours', '교육시간'],
  ['topics', '희망과정'],
  ['message', '문의내용'],
  ['agree', '개인정보동의'],
  ['smsResult', '문자발송'],
  ['memo', '메모'],
];

/* ============================================================
   웹앱 진입점
   ============================================================ */

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = parseBody_(e);

    // 스팸 차단: 사람에게는 보이지 않는 칸(website)이 채워져 있으면 저장하지 않음
    if (data.website) return json_({ ok: true });

    const required = ['org', 'name', 'phone'];
    const missing = required.filter((k) => !clean_(data[k]));
    if (missing.length) return json_({ ok: false, error: 'missing', fields: missing });
    if (String(data.agree) !== 'true') return json_({ ok: false, error: 'agree' });

    const row = {
      receivedAt: new Date(),
      status: '신규',
      type: clean_(data.type) || '기관 맞춤교육 문의',
      org: clean_(data.org),
      orgType: clean_(data.orgType),
      name: clean_(data.name),
      phone: formatPhone_(data.phone),
      email: clean_(data.email),
      target: clean_(data.target),
      date: clean_(data.date),
      hours: clean_(data.hours),
      topics: clean_(data.topics, 1000),
      message: clean_(data.message, 3000),
      agree: '동의',
      smsResult: '',
      memo: '',
    };

    const sheet = getSheet_();
    sheet.appendRow(COLUMNS.map(([key]) => sheetSafe_(row[key])));
    const rowIndex = sheet.getLastRow();

    // 알림은 저장 이후에 — 문자 발송이 실패해도 신청 내용은 시트에 남습니다.
    const smsResult = notifyAdmin_(row);
    sheet.getRange(rowIndex, colOf_('smsResult')).setValue(smsResult);
    notifyEmail_(row);
    notifyApplicant_(row);

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, service: '복지인사이트 교육신청 수신기' });
}

/* ============================================================
   처음 한 번 실행: 시트 머리글·서식 준비
   ============================================================ */

function setup() {
  const sheet = getSheet_();
  const headers = COLUMNS.map(([, label]) => label);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#14160a').setFontColor('#fbfbf2');
  sheet.setFrozenRows(1);
  sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(1, colOf_('phone'), sheet.getMaxRows(), 1).setNumberFormat('@'); // 010 앞자리 0 유지
  sheet.setColumnWidth(colOf_('message'), 360);
  sheet.setColumnWidth(colOf_('topics'), 260);

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['신규', '연락완료', '제안발송', '확정', '완료', '보류'], true).build();
  sheet.getRange(2, colOf_('status'), sheet.getMaxRows() - 1, 1).setDataValidation(rule);

  console.log('시트 준비 완료: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

/* 설정 확인용: 담당자에게 시험 문자를 보냅니다. */
function testSms() {
  const result = notifyAdmin_({
    org: '테스트기관', name: '홍길동', phone: '010-0000-0000', type: '테스트',
    hours: '3시간', date: '협의', topics: '01 생성형 AI 통합 기초과정',
  });
  console.log('문자 발송 결과: ' + result);
}

/* ============================================================
   알림
   ============================================================ */

function notifyAdmin_(row) {
  const p = props_();
  if (!p.SOLAPI_API_KEY || !p.SOLAPI_API_SECRET || !p.SMS_FROM || !p.ADMIN_PHONE) return '미설정';

  const lines = [
    '[복지인사이트] 교육신청 접수',
    `기관: ${row.org}${row.orgType ? ` (${row.orgType})` : ''}`,
    `담당: ${row.name} ${row.phone}`,
    row.target && `대상: ${row.target}`,
    row.date && `일정: ${row.date}`,
    row.hours && `시간: ${row.hours}`,
    row.topics && `과정: ${row.topics}`,
  ].filter(Boolean);

  const results = p.ADMIN_PHONE.split(',').map((to) => sendSms_(to, lines.join('\n')));
  return results.every((r) => r.ok) ? '발송완료' : '실패: ' + results.map((r) => r.error).filter(Boolean).join(' / ');
}

function notifyApplicant_(row) {
  const p = props_();
  if (String(p.NOTIFY_APPLICANT) !== 'true' || !p.SOLAPI_API_KEY) return;
  const text = `[복지인사이트] ${row.name}님, ${row.org} 교육신청이 접수되었습니다. 확인 후 연락드리겠습니다. 문의 ${p.SMS_FROM}`;
  sendSms_(row.phone, text);
}

function notifyEmail_(row) {
  const to = props_().ADMIN_EMAIL;
  if (!to) return;
  const body = COLUMNS
    .filter(([key]) => !['status', 'smsResult', 'memo'].includes(key) && row[key])
    .map(([key, label]) => `■ ${label}: ${key === 'receivedAt' ? Utilities.formatDate(row[key], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : row[key]}`)
    .join('\n');
  MailApp.sendEmail({
    to,
    subject: `[복지인사이트 교육신청] ${row.org} · ${row.name}`,
    body: body + '\n\n신청내역 시트: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  });
}

/* 솔라피 메시지 발송 (길이에 따라 SMS/LMS 자동 선택) */
function sendSms_(to, text) {
  const p = props_();
  const date = new Date().toISOString();
  const salt = Utilities.getUuid().replace(/-/g, '');
  const sig = Utilities.computeHmacSha256Signature(date + salt, p.SOLAPI_API_SECRET)
    .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');

  try {
    const res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `HMAC-SHA256 apiKey=${p.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${sig}` },
      payload: JSON.stringify({ message: { to: digits_(to), from: digits_(p.SMS_FROM), text } }),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    if (code >= 200 && code < 300) return { ok: true };
    console.error('SOLAPI ' + code + ' ' + res.getContentText());
    let msg = 'HTTP ' + code;
    try { msg = JSON.parse(res.getContentText()).errorMessage || msg; } catch (_) {}
    return { ok: false, error: msg };
  } catch (err) {
    console.error(err);
    return { ok: false, error: String(err.message || err) };
  }
}

/* ============================================================
   도우미
   ============================================================ */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 이름이 '신청내역'인 탭이 없으면 첫 번째 탭을 그 이름으로 바꿔 사용
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0].setName(SHEET_NAME);
}

function colOf_(key) {
  return COLUMNS.findIndex(([k]) => k === key) + 1;
}

function props_() {
  return PropertiesService.getScriptProperties().getProperties();
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (_) {}
  }
  return (e && e.parameter) || {};
}

// 공백 정리 + 길이 제한
function clean_(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max || 300);
}

// 시트 수식 주입 방지: =, +, -, @ 로 시작하는 글자는 문자열로 저장
function sheetSafe_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function digits_(v) {
  return String(v || '').replace(/\D/g, '');
}

function formatPhone_(v) {
  const d = digits_(v);
  if (/^01\d{8,9}$/.test(d)) return d.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
  if (/^0\d{8,10}$/.test(d)) return d.replace(/^(0\d{1,2})(\d{3,4})(\d{4})$/, '$1-$2-$3');
  return clean_(v, 30);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

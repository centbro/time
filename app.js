/* 센터 양식(출장신청서/출장복명서) 미리보기 + PDF 생성 */
const form = document.getElementById('tripForm');
const resetBtn = document.getElementById('resetBtn');
const printBtn = document.getElementById('printBtn');
const showAppBtn = document.getElementById('show-application');
const showRepBtn = document.getElementById('show-report');
const generatePdfBtn = document.getElementById('generatePdf');
const travelerList = document.getElementById('travelerList');
const addTravelerBtn = document.getElementById('addTravelerBtn');

const TRAVELER_TABLE_MIN_ROWS = 8; // 데이터 행 + '이하 여백' 행 + 빈 행을 합쳐 표를 채우는 최소 줄 수

function toDateInputValue(date) {
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateDot(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.`;
}

function formatDuration(startStr, endStr) {
  if (!startStr || !endStr) return '-';
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (Number.isNaN(diff) || diff < 0) return '-';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('ko-KR').format(value || 0) + '원';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[s]));
}

function createTravelerRow(data = {}) {
  const row = document.createElement('div');
  row.className = 'traveler-row';
  row.innerHTML = `
    <button type="button" class="remove-row" title="삭제">✕</button>
    <label>직책<input type="text" class="t-position" placeholder="예: 사회복지사" /></label>
    <label>성명<input type="text" class="t-name" placeholder="성명" /></label>
    <label>출장목적<input type="text" class="t-purpose" placeholder="출장목적" /></label>
    <label>출장지<input type="text" class="t-destination" placeholder="출장지" /></label>
    <label>날짜<input type="date" class="t-date" /></label>
    <label>시작시간<input type="time" class="t-start" /></label>
    <label>종료시간<input type="time" class="t-end" /></label>
    <label class="checkbox-inline"><input type="checkbox" class="t-vehicle" /> 관차사용</label>
  `;

  row.querySelector('.t-position').value = data.position || '';
  row.querySelector('.t-name').value = data.name || '';
  row.querySelector('.t-purpose').value = data.purpose || '';
  row.querySelector('.t-destination').value = data.destination || '';
  row.querySelector('.t-date').value = data.date || toDateInputValue(new Date());
  row.querySelector('.t-start').value = data.start || '09:00';
  row.querySelector('.t-end').value = data.end || '18:00';
  row.querySelector('.t-vehicle').checked = !!data.vehicle;

  row.querySelector('.remove-row').addEventListener('click', () => {
    if (travelerList.children.length <= 1) return;
    row.remove();
    fillPreview();
  });

  row.querySelectorAll('input').forEach((el) => {
    const evt = (el.type === 'text') ? 'input' : 'change';
    el.addEventListener(evt, fillPreview);
  });

  return row;
}

function getTravelers() {
  return Array.from(travelerList.querySelectorAll('.traveler-row')).map((row) => ({
    position: row.querySelector('.t-position').value || '-',
    name: row.querySelector('.t-name').value || '-',
    purpose: row.querySelector('.t-purpose').value || '-',
    destination: row.querySelector('.t-destination').value || '-',
    date: row.querySelector('.t-date').value,
    start: row.querySelector('.t-start').value,
    end: row.querySelector('.t-end').value,
    vehicle: row.querySelector('.t-vehicle').checked,
  }));
}

function buildTravelerRowsHtml(travelers) {
  const cols = 8;
  const dataRows = travelers.map((t) => `
    <tr>
      <td>${escapeHtml(t.position)}</td>
      <td>${escapeHtml(t.name)}</td>
      <td>${escapeHtml(t.purpose)}</td>
      <td>${escapeHtml(t.destination)}</td>
      <td>${formatDateDot(t.date)} ${escapeHtml(t.start || '')}-${escapeHtml(t.end || '')}</td>
      <td>${formatDuration(t.start, t.end)}</td>
      <td>${t.vehicle ? '○' : ''}</td>
      <td></td>
    </tr>`).join('');
  const blankRow = `<tr class="filler-row"><td colspan="${cols}">- 이하 여백 -</td></tr>`;
  const emptyCount = Math.max(0, TRAVELER_TABLE_MIN_ROWS - travelers.length - 1);
  const emptyRows = Array.from({ length: emptyCount })
    .map(() => `<tr>${'<td>&nbsp;</td>'.repeat(cols)}</tr>`)
    .join('');
  return dataRows + blankRow + emptyRows;
}

function fillPreview() {
  const travelers = getTravelers();
  const requestDate = document.getElementById('requestDate').value;
  const reportDate = document.getElementById('reportDate').value;
  const helper = document.getElementById('helper').value || '-';
  const etcTransport = document.getElementById('etcTransport').value || '-';
  const dailyRate = Number(document.getElementById('dailyRate').value) || 0;
  const transportCost = Number(document.getElementById('transportCost').value) || 0;
  const lodgingCost = Number(document.getElementById('lodgingCost').value) || 0;
  const mealCost = Number(document.getElementById('mealCost').value) || 0;
  const reportContent = document.getElementById('reportContent').value || '-';

  const travelerRowsHtml = buildTravelerRowsHtml(travelers);
  const dailyTotal = dailyRate * travelers.length;
  const dailyAllowanceText = dailyTotal > 0
    ? `${formatCurrency(dailyRate)} * ${travelers.length}명 = ${formatCurrency(dailyTotal)}`
    : '-';

  document.getElementById('appDate').textContent = formatDateDot(requestDate);
  document.getElementById('appHelper').textContent = helper;
  document.getElementById('appTravelerRows').innerHTML = travelerRowsHtml;
  document.getElementById('appTransportPreview').textContent = etcTransport;
  document.getElementById('appTransportCostPreview').textContent = transportCost > 0 ? formatCurrency(transportCost) : '-';
  document.getElementById('appLodgingCostPreview').textContent = lodgingCost > 0 ? formatCurrency(lodgingCost) : '-';
  document.getElementById('appMealCostPreview').textContent = mealCost > 0 ? formatCurrency(mealCost) : '-';
  document.getElementById('appDailyAllowancePreview').textContent = dailyAllowanceText;

  document.getElementById('repDate').textContent = formatDateDot(reportDate || requestDate);
  document.getElementById('repHelper').textContent = helper;
  document.getElementById('repTravelerRows').innerHTML = travelerRowsHtml;
  document.getElementById('repTransportPreview').textContent = etcTransport;
  document.getElementById('repTransportCostPreview').textContent = transportCost > 0 ? formatCurrency(transportCost) : '-';
  document.getElementById('repLodgingCostPreview').textContent = lodgingCost > 0 ? formatCurrency(lodgingCost) : '-';
  document.getElementById('repMealCostPreview').textContent = mealCost > 0 ? formatCurrency(mealCost) : '-';
  document.getElementById('repDailyAllowancePreview').textContent = dailyAllowanceText;
  document.getElementById('repContentPreview').textContent = reportContent;
}

async function generatePdfForVisiblePreview() {
  const previewApp = document.getElementById('previewApplication');
  const previewRep = document.getElementById('previewReport');
  const target = previewApp.classList.contains('hidden') ? previewRep : previewApp;

  try {
    const canvas = await html2canvas(target, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height);
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width * ratio, canvas.height * ratio);
    pdf.save('출장_양식.pdf');
  } catch (err) {
    console.error(err);
    alert('PDF 생성 중 오류가 발생했습니다. 콘솔을 확인하세요.');
  }
}

function resetForm() {
  document.getElementById('requestDate').value = toDateInputValue(new Date());
  document.getElementById('reportDate').value = '';
  document.getElementById('helper').value = '';
  document.getElementById('etcTransport').value = '센터 차량';
  document.getElementById('dailyRate').value = 10000;
  document.getElementById('transportCost').value = 0;
  document.getElementById('lodgingCost').value = 0;
  document.getElementById('mealCost').value = 0;
  document.getElementById('reportContent').value = '';
  travelerList.innerHTML = '';
  travelerList.appendChild(createTravelerRow());
  fillPreview();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('requestDate').value = toDateInputValue(new Date());
  travelerList.appendChild(createTravelerRow());
  fillPreview();

  form.addEventListener('submit', (e) => { e.preventDefault(); fillPreview(); });
  resetBtn.addEventListener('click', resetForm);
  addTravelerBtn.addEventListener('click', () => {
    travelerList.appendChild(createTravelerRow());
    fillPreview();
  });

  ['requestDate', 'reportDate', 'helper', 'etcTransport', 'dailyRate', 'transportCost', 'lodgingCost', 'mealCost', 'reportContent']
    .forEach((id) => {
      const el = document.getElementById(id);
      const evt = (el.tagName === 'TEXTAREA' || el.type === 'text') ? 'input' : 'change';
      el.addEventListener(evt, fillPreview);
    });

  if (showAppBtn) showAppBtn.addEventListener('click', () => { document.getElementById('previewApplication').classList.remove('hidden'); document.getElementById('previewReport').classList.add('hidden'); });
  if (showRepBtn) showRepBtn.addEventListener('click', () => { document.getElementById('previewReport').classList.remove('hidden'); document.getElementById('previewApplication').classList.add('hidden'); });
  if (generatePdfBtn) generatePdfBtn.addEventListener('click', () => generatePdfForVisiblePreview());
  if (printBtn) printBtn.addEventListener('click', () => window.print());
});

/* 센터 양식(출장신청서/출장복명서) 미리보기 + PDF 생성 */
const form = document.getElementById('tripForm');
const resetBtn = document.getElementById('resetBtn');
const printBtn = document.getElementById('printBtn');
const showAppBtn = document.getElementById('show-application');
const showRepBtn = document.getElementById('show-report');
const generatePdfBtn = document.getElementById('generatePdf');
const PREVIEW_PANEL_IDS = ['previewApplication', 'previewReport'];
const travelerList = document.getElementById('travelerList');
const addTravelerBtn = document.getElementById('addTravelerBtn');
const tabFormBtn = document.getElementById('tab-form');
const tabWorklogBtn = document.getElementById('tab-worklog');
const formView = document.getElementById('formView');
const worklogView = document.getElementById('worklogView');
const worklogCalcList = document.getElementById('worklogCalcList');
const addWorklogRowBtn = document.getElementById('addWorklogRowBtn');

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

function durationHours(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff / 60 : 0;
}

function formatDuration(startStr, endStr) {
  const hours = durationHours(startStr, endStr);
  if (!startStr || !endStr || hours <= 0) return '-';
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// 2026년 센터 여비 지급 기준: 관내(화성시)/관외 × 이동수단 × 출장시간 (일비만 자동계산, 식비는 영수증 실비라 직접 입력)
function calcTravelerAllowance(scope, vehicle, hours) {
  if (scope === '관내') {
    if (vehicle === '관용차량') return hours >= 4 ? 10000 : 0;
    return hours >= 4 ? 20000 : 10000; // 자차 이용
  }
  const days = Math.max(1, Math.ceil(hours / 24)); // 관외
  return vehicle === '관용차량' ? 12500 * days : 25000 * days;
}

const MEAL_COST_CAP = 25000;

function clampMealCost(input) {
  const value = Number(input.value) || 0;
  if (value > MEAL_COST_CAP) input.value = MEAL_COST_CAP;
  if (value < 0) input.value = 0;
}

const SCOPE_VEHICLE_OPTIONS = {
  관내: ['관용차량', '자차 이용'],
  관외: ['관용차량', '자차 이용', '대중교통'],
};

function updateVehicleOptions(row, preferredValue) {
  const scope = row.querySelector('.t-scope').value;
  const vehicleSelect = row.querySelector('.t-vehicle');
  const current = preferredValue || vehicleSelect.value;
  const options = SCOPE_VEHICLE_OPTIONS[scope] || SCOPE_VEHICLE_OPTIONS['관내'];
  vehicleSelect.innerHTML = options.map((o) => `<option value="${o}">${o}</option>`).join('');
  vehicleSelect.value = options.includes(current) ? current : options[0];
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
    <label>출장구분
      <select class="t-scope">
        <option value="관내">관내 출장(화성시)</option>
        <option value="관외">관외 출장</option>
      </select>
    </label>
    <label>이동수단<select class="t-vehicle"></select></label>
  `;

  row.querySelector('.t-position').value = data.position || '';
  row.querySelector('.t-name').value = data.name || '';
  row.querySelector('.t-purpose').value = data.purpose || '';
  row.querySelector('.t-destination').value = data.destination || '';
  row.querySelector('.t-date').value = data.date || toDateInputValue(new Date());
  row.querySelector('.t-start').value = data.start || '09:00';
  row.querySelector('.t-end').value = data.end || '18:00';
  row.querySelector('.t-scope').value = data.scope || '관내';
  updateVehicleOptions(row, data.vehicle);

  row.querySelector('.remove-row').addEventListener('click', () => {
    if (travelerList.children.length <= 1) return;
    row.remove();
    fillPreview();
  });

  row.querySelector('.t-scope').addEventListener('change', () => {
    updateVehicleOptions(row);
    fillPreview();
  });

  row.querySelectorAll('input, select').forEach((el) => {
    if (el.classList.contains('t-scope')) return; // wired separately above
    const evt = (el.type === 'text') ? 'input' : 'change';
    el.addEventListener(evt, fillPreview);
  });

  return row;
}

function getTravelers() {
  return Array.from(travelerList.querySelectorAll('.traveler-row')).map((row) => {
    const start = row.querySelector('.t-start').value;
    const end = row.querySelector('.t-end').value;
    const scope = row.querySelector('.t-scope').value;
    const vehicle = row.querySelector('.t-vehicle').value;
    const hours = durationHours(start, end);
    const allowance = calcTravelerAllowance(scope, vehicle, hours);
    return {
      position: row.querySelector('.t-position').value || '-',
      name: row.querySelector('.t-name').value || '-',
      purpose: row.querySelector('.t-purpose').value || '-',
      destination: row.querySelector('.t-destination').value || '-',
      date: row.querySelector('.t-date').value,
      start,
      end,
      scope,
      vehicle,
      hours,
      allowance,
    };
  });
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
      <td>${t.vehicle === '관용차량' ? '○' : ''}</td>
      <td></td>
    </tr>`).join('');
  const blankRow = `<tr class="filler-row"><td colspan="${cols}">- 이하 여백 -</td></tr>`;
  const emptyCount = Math.max(0, TRAVELER_TABLE_MIN_ROWS - travelers.length - 1);
  const emptyRows = Array.from({ length: emptyCount })
    .map(() => `<tr>${'<td>&nbsp;</td>'.repeat(cols)}</tr>`)
    .join('');
  return dataRows + blankRow + emptyRows;
}

function createWorklogRow() {
  const row = document.createElement('div');
  row.className = 'worklog-calc-row';
  row.innerHTML = `
    <button type="button" class="remove-row" title="삭제">✕</button>
    <label>출발 시간<input type="time" class="w-start" /></label>
    <label>도착 시간<input type="time" class="w-end" /></label>
    <div class="worklog-result">총 출장 시간<strong class="w-total">-</strong></div>
  `;

  function updateTotal() {
    const start = row.querySelector('.w-start').value;
    const end = row.querySelector('.w-end').value;
    row.querySelector('.w-total').textContent = formatDuration(start, end);
  }

  row.querySelectorAll('input[type=time]').forEach((el) => el.addEventListener('change', updateTotal));
  row.querySelector('.remove-row').addEventListener('click', () => {
    if (worklogCalcList.children.length <= 1) return;
    row.remove();
  });

  return row;
}

function renderCostBreakdown(travelers, totalAllowance) {
  const el = document.getElementById('costBreakdown');
  const cards = travelers.map((t) => `
    <div class="summary-card">
      <span>${escapeHtml(t.name)} (${t.scope} · ${t.vehicle})</span>
      <strong>${formatCurrency(t.allowance)}</strong>
    </div>`).join('');
  el.innerHTML = `${cards}
    <div class="summary-card accent">
      <span>일비 합계</span>
      <strong>${formatCurrency(totalAllowance)}</strong>
    </div>`;
}

function fillPreview() {
  const travelers = getTravelers();
  const requestDate = document.getElementById('requestDate').value;
  const reportDate = document.getElementById('reportDate').value;
  const etcTransport = document.getElementById('etcTransport').value || '-';
  const transportCost = Number(document.getElementById('transportCost').value) || 0;
  const lodgingCost = Number(document.getElementById('lodgingCost').value) || 0;
  const mealCost = Math.min(MEAL_COST_CAP, Number(document.getElementById('mealCost').value) || 0);
  const reportContent = document.getElementById('reportContent').value || '-';

  const totalAllowance = travelers.reduce((sum, t) => sum + t.allowance, 0);
  renderCostBreakdown(travelers, totalAllowance);

  const travelerRowsHtml = buildTravelerRowsHtml(travelers);
  const dailyAllowanceText = totalAllowance > 0 ? formatCurrency(totalAllowance) : '-';
  const mealText = mealCost > 0 ? formatCurrency(mealCost) : '-';

  document.getElementById('appDate').textContent = formatDateDot(requestDate);
  document.getElementById('appTravelerRows').innerHTML = travelerRowsHtml;
  document.getElementById('appTransportPreview').textContent = etcTransport;
  document.getElementById('appTransportCostPreview').textContent = transportCost > 0 ? formatCurrency(transportCost) : '-';
  document.getElementById('appLodgingCostPreview').textContent = lodgingCost > 0 ? formatCurrency(lodgingCost) : '-';
  document.getElementById('appMealCostPreview').textContent = mealText;
  document.getElementById('appDailyAllowancePreview').textContent = dailyAllowanceText;

  document.getElementById('repDate').textContent = formatDateDot(reportDate || requestDate);
  document.getElementById('repTravelerRows').innerHTML = travelerRowsHtml;
  document.getElementById('repTransportPreview').textContent = etcTransport;
  document.getElementById('repTransportCostPreview').textContent = transportCost > 0 ? formatCurrency(transportCost) : '-';
  document.getElementById('repLodgingCostPreview').textContent = lodgingCost > 0 ? formatCurrency(lodgingCost) : '-';
  document.getElementById('repMealCostPreview').textContent = mealText;
  document.getElementById('repDailyAllowancePreview').textContent = dailyAllowanceText;
  document.getElementById('repContentPreview').textContent = reportContent;
}

async function generatePdfForVisiblePreview() {
  const target = PREVIEW_PANEL_IDS
    .map((id) => document.getElementById(id))
    .find((el) => !el.classList.contains('hidden'));
  if (!target) return;

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
  document.getElementById('etcTransport').value = '센터 차량';
  document.getElementById('transportCost').value = 0;
  document.getElementById('lodgingCost').value = 0;
  document.getElementById('mealCost').value = 0;
  document.getElementById('reportContent').value = '';
  travelerList.innerHTML = '';
  travelerList.appendChild(createTravelerRow());
  fillPreview();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

let deferredInstallPrompt = null;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installBtn.classList.add('hidden');
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    installBtn.disabled = true;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.disabled = false;
    installBtn.classList.add('hidden');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('requestDate').value = toDateInputValue(new Date());
  travelerList.appendChild(createTravelerRow());
  fillPreview();

  worklogCalcList.appendChild(createWorklogRow());
  addWorklogRowBtn.addEventListener('click', () => {
    worklogCalcList.appendChild(createWorklogRow());
  });

  tabFormBtn.addEventListener('click', () => {
    formView.classList.remove('hidden');
    worklogView.classList.add('hidden');
    tabFormBtn.className = 'primary tab-btn';
    tabWorklogBtn.className = 'secondary tab-btn';
  });
  tabWorklogBtn.addEventListener('click', () => {
    worklogView.classList.remove('hidden');
    formView.classList.add('hidden');
    tabWorklogBtn.className = 'primary tab-btn';
    tabFormBtn.className = 'secondary tab-btn';
  });

  form.addEventListener('submit', (e) => { e.preventDefault(); fillPreview(); });
  resetBtn.addEventListener('click', resetForm);
  addTravelerBtn.addEventListener('click', () => {
    travelerList.appendChild(createTravelerRow());
    fillPreview();
  });

  ['requestDate', 'reportDate', 'etcTransport', 'transportCost', 'lodgingCost', 'mealCost', 'reportContent']
    .forEach((id) => {
      const el = document.getElementById(id);
      const evt = (el.tagName === 'TEXTAREA' || el.type === 'text') ? 'input' : 'change';
      el.addEventListener(evt, fillPreview);
    });

  const mealCostInput = document.getElementById('mealCost');
  mealCostInput.addEventListener('input', () => { clampMealCost(mealCostInput); fillPreview(); });

  function showPanel(activeId) {
    PREVIEW_PANEL_IDS.forEach((id) => {
      document.getElementById(id).classList.toggle('hidden', id !== activeId);
    });
  }
  if (showAppBtn) showAppBtn.addEventListener('click', () => showPanel('previewApplication'));
  if (showRepBtn) showRepBtn.addEventListener('click', () => showPanel('previewReport'));
  if (generatePdfBtn) generatePdfBtn.addEventListener('click', () => generatePdfForVisiblePreview());
  if (printBtn) printBtn.addEventListener('click', () => window.print());
});

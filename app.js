/* Clean preview + PDF generation script */
const form = document.getElementById('tripForm');
const startInput = document.getElementById('startAt');
const endInput = document.getElementById('endAt');
const resetBtn = document.getElementById('resetBtn');
const printBtn = document.getElementById('printBtn');
const showAppBtn = document.getElementById('show-application');
const showRepBtn = document.getElementById('show-report');
const generatePdfBtn = document.getElementById('generatePdf');
// Note: signature and photos inputs are intentionally not embedded into the generated PDF per user choice.

function setDefaultTimes() {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000);
  startInput.value = toDateTimeLocal(start);
  endInput.value = toDateTimeLocal(end);
}

function toDateTimeLocal(date) {
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatKoreanDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} ${hh}:${mm}`;
}

function fillPreview() {
  const name = document.getElementById('name').value || '-';
  const dept = document.getElementById('department').value || '-';
  const pos = document.getElementById('position').value || '-';
  const dest = document.getElementById('destination').value || '-';
  const purpose = document.getElementById('purpose').value || '-';
  const transport = document.getElementById('transport').value || '-';
  const budget = Number(document.getElementById('budget').value || 0);
  const notes = document.getElementById('notes').value || '-';
  const start = new Date(startInput.value);
  const end = new Date(endInput.value);

  // calculate costs based on 2026 기준
  const scope = document.getElementById('tripScope') ? document.getElementById('tripScope').value : '관내';
  const vehicle = document.getElementById('vehicleType') ? document.getElementById('vehicleType').value : '관용차';
  const receipt = Number(document.getElementById('receiptAmount') ? document.getElementById('receiptAmount').value : 0) || 0;
  const receiptProvided = document.getElementById('receiptProvided') ? document.getElementById('receiptProvided').checked : false;
  const parking = Number(document.getElementById('parkingAmount') ? document.getElementById('parkingAmount').value : 0) || 0;
  const toll = Number(document.getElementById('tollAmount') ? document.getElementById('tollAmount').value : 0) || 0;
  const receiptTotalInput = receipt + parking + toll;
  const costs = calculateCosts(start, end, scope, vehicle, receiptTotalInput, receiptProvided);
  document.getElementById('appDailyAllowancePreview').textContent = formatCurrency(costs.allowance);
  document.getElementById('appMealCostPreview').textContent = formatCurrency(costs.meal);
  document.getElementById('appTransportCostPreview').textContent = formatCurrency(costs.receipt);

  // also show totals on 복명서
  const repNotes = document.getElementById('repDetailsPreview');
  // append cost summary to 복명서 details
  let costSummary = `일비: ${formatCurrency(costs.allowance)} / 식비: ${formatCurrency(costs.meal)} / 합계: ${formatCurrency(costs.total)}`;
  if(costs.receipt > 0){
    if(costs.receiptIncluded){
      costSummary = `일비: ${formatCurrency(costs.allowance)} / 식비: ${formatCurrency(costs.meal)} / 실비(영수증 포함): ${formatCurrency(costs.receipt)} / 합계: ${formatCurrency(costs.total)}`;
    } else {
      costSummary = `일비: ${formatCurrency(costs.allowance)} / 식비: ${formatCurrency(costs.meal)} / 실비(영수증 미첨부 - 지급 불포함): ${formatCurrency(costs.receipt)} / 합계(실비 미포함): ${formatCurrency(costs.totalNoReceipt)}`;
    }
  }
  const costLi = document.createElement('li'); costLi.textContent = costSummary; repNotes.appendChild(costLi);

  document.getElementById('appNamePreview').textContent = name;
  document.getElementById('appPositionPreview').textContent = pos;
  document.getElementById('appPurposePreview').textContent = purpose;
  document.getElementById('appDestinationPreview').textContent = dest;
  document.getElementById('appTransportPreview').textContent = transport;
  document.getElementById('appDate').textContent = formatKoreanDate(new Date());
  document.getElementById('appHelper').textContent = dept;
  document.getElementById('appPeriodPreview').textContent = (isNaN(start.getTime()) || isNaN(end.getTime())) ? '-' : `${formatKoreanDate(start)} ~ ${formatKoreanDate(end)}`;
  document.getElementById('appTimePreview').textContent = (isNaN(start.getTime()) || isNaN(end.getTime())) ? '-' : `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')} ~ ${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`;
  document.getElementById('appVehiclePreview').textContent = '-';
  document.getElementById('appTransportCostPreview').textContent = '-';
  document.getElementById('appMealCostPreview').textContent = '-';
  document.getElementById('appDailyAllowancePreview').textContent = '-';
  document.getElementById('signatureUser').textContent = name;

  // 복명서
  document.getElementById('repAuthorPreview').textContent = name;
  document.getElementById('repDate').textContent = formatKoreanDate(new Date());
  document.getElementById('repNamePreview').textContent = name;
  document.getElementById('repPositionPreview').textContent = pos;
  document.getElementById('repPurposePreview').textContent = purpose;
  document.getElementById('repDestinationPreview').textContent = dest;
  document.getElementById('repPeriodPreview').textContent = (isNaN(start.getTime()) || isNaN(end.getTime())) ? '-' : `${formatKoreanDate(start)} ~ ${formatKoreanDate(end)}`;
  document.getElementById('repTimePreview').textContent = document.getElementById('appTimePreview').textContent;
  const ul = document.getElementById('repDetailsPreview'); ul.innerHTML = '';
  const detailLi = document.createElement('li'); detailLi.textContent = notes; ul.appendChild(detailLi);
}

function formatCurrency(value){
  return new Intl.NumberFormat('ko-KR').format(value || 0) + '원';
}

function calculateCosts(start, end, scope, vehicle, receipt, receiptIncluded){
  // compute duration in hours
  let totalMinutes = 0;
  if(start instanceof Date && !isNaN(start.getTime()) && end instanceof Date && !isNaN(end.getTime())){
    totalMinutes = Math.max(0, Math.round((end.getTime() - start.getTime())/60000));
  }
  const hours = Math.ceil(totalMinutes/60);
  // defaults
  let allowance = 0; // 일비
  let meal = 0;
  let receiptCost = receipt || 0;

  if(scope === '관내'){
    // 관용차
    if(vehicle === '관용차'){
      if(hours >= 4) allowance = 10000; else allowance = 0;
      meal = 0;
    } else if(vehicle === '자차' || vehicle === '대중교통'){
      if(hours < 4) allowance = 10000; else allowance = 20000;
      meal = 0;
    }
  } else { // 관외
    const days = Math.max(1, Math.ceil(hours/24));
    if(vehicle === '관용차'){
      allowance = 12500 * days;
      meal = 25000 * days;
    } else if(vehicle === '자차' || vehicle === '대중교통'){
      allowance = 25000 * days;
      meal = 25000 * days;
    }
  }

  const includedReceipt = receiptIncluded ? receiptCost : 0;
  const total = allowance + meal + includedReceipt;
  const totalNoReceipt = allowance + meal;
  return { allowance, meal, receipt: receiptCost, receiptIncluded: !!receiptIncluded, total, totalNoReceipt, hours };
}

function readFileAsDataURL(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=> res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

async function generatePdfForVisiblePreview(){
  const previewApp = document.getElementById('previewApplication');
  const previewRep = document.getElementById('previewReport');
  const target = previewApp.classList.contains('hidden') ? previewRep : previewApp;

  try{
    const canvas = await html2canvas(target, {scale:2, useCORS:true});
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','pt','a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = Math.min(pdfW / imgW, pdfH / imgH);
    const drawW = imgW * ratio;
    const drawH = imgH * ratio;
    pdf.addImage(imgData, 'PNG', 0, 0, drawW, drawH);

    // Per user request, uploaded signature and photos are NOT embedded into the PDF here.

    pdf.save('출장_양식.pdf');
  }catch(err){
    console.error(err);
    alert('PDF 생성 중 오류가 발생했습니다. 콘솔을 확인하세요.');
  }
}

// wire UI
document.addEventListener('DOMContentLoaded', ()=>{
  setDefaultTimes();
  fillPreview();

  form.addEventListener('submit', (e)=>{ e.preventDefault(); fillPreview(); });
  resetBtn.addEventListener('click', ()=>{ form.reset(); setDefaultTimes(); fillPreview(); });
  // update preview when key inputs change
  const scopeEl = document.getElementById('tripScope');
  const vehicleEl = document.getElementById('vehicleType');
  const receiptEl = document.getElementById('receiptAmount');
  if(scopeEl) scopeEl.addEventListener('change', fillPreview);
  if(vehicleEl) vehicleEl.addEventListener('change', fillPreview);
  if(receiptEl) receiptEl.addEventListener('input', fillPreview);
  if(startInput) startInput.addEventListener('change', fillPreview);
  if(endInput) endInput.addEventListener('change', fillPreview);
  const receiptProvidedEl = document.getElementById('receiptProvided');
  const parkingEl = document.getElementById('parkingAmount');
  const tollEl = document.getElementById('tollAmount');
  if(receiptProvidedEl) receiptProvidedEl.addEventListener('change', fillPreview);
  if(parkingEl) parkingEl.addEventListener('input', fillPreview);
  if(tollEl) tollEl.addEventListener('input', fillPreview);
  if(showAppBtn) showAppBtn.addEventListener('click', ()=>{ document.getElementById('previewApplication').classList.remove('hidden'); document.getElementById('previewReport').classList.add('hidden'); });
  if(showRepBtn) showRepBtn.addEventListener('click', ()=>{ document.getElementById('previewReport').classList.remove('hidden'); document.getElementById('previewApplication').classList.add('hidden'); });
  if(generatePdfBtn) generatePdfBtn.addEventListener('click', ()=> generatePdfForVisiblePreview());
  if(printBtn) printBtn.addEventListener('click', ()=> window.print());
});

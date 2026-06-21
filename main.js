 // ====================================================================
 // main.js
 // ----------------------------------------------------------------------
 // UI logic: navigation, forms, tables, modals, reports, printing.
 // Uses `data`, `db`, the Firestore collection refs, and the dbSetDoc/
 // dbAddDoc/dbDeleteDoc/dbSaveCounter/loadData helpers - all defined in
 // server.js, which must be loaded before this file.
 // ====================================================================

 // ==================== NAVIGATION ====================
 function showSection(name) {
 document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
 document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

 document.getElementById(`section-${name}`).classList.add('active');

 const navItems = document.querySelectorAll('.nav-item');
 const sectionMap = {
 'dashboard': 0, 'registration': 1, 'attendance': 2,
 'financial': 3, 'salaries': 4, 'reports': 5
 };
 navItems[sectionMap[name]]?.classList.add('active');

 if (name === 'dashboard') updateDashboard();
 if (name === 'registration') updateTraineesTable();
 if (name === 'financial') updateFinancial();
 if (name === 'salaries') updateSalaries();
 if (name === 'attendance') updateAttendanceLog();
 if (name === 'reports') updateReports();
 }

 // ==================== REGISTRATION ====================
 let currentType = 'subscription';

 function switchTab(type) {
 currentType = type;
 document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
 document.getElementById(`tab-${type}`).classList.add('active');

 const subOnlyFields = document.querySelectorAll('.sub-only');
 subOnlyFields.forEach(f => {
 f.style.display = type === 'subscription' ? 'flex' : 'none';
 });
 }

 function generateID() {
 const pad = (n) => String(n).padStart(4, '0');
 const year = new Date().getFullYear();
 return `RCR-${year}-${pad(data.counter++)}`;
 }

 function addDays(dateStr, days) {
 const d = new Date(dateStr);
 d.setDate(d.getDate() + parseInt(days || 0));
 const y = d.getFullYear();
 const m = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 return `${y}-${m}-${day}`;
 }

 function registerTrainee() {
 const name = document.getElementById('reg-name').value.trim();
 const phone = document.getElementById('reg-phone').value.trim();
 const age = document.getElementById('reg-age').value;
 const gender = document.getElementById('reg-gender').value;
 const sport = document.getElementById('reg-sport').value;
 const startDate = document.getElementById('reg-start-date').value;
 const duration = document.getElementById('reg-duration').value || 30;
 const amount = document.getElementById('reg-amount').value;
 const notes = document.getElementById('reg-notes').value;

 if (!name || !phone) {
 showNotification('يرجى ملء الاسم ورقم الهاتف على الأقل', 'warning');
 return;
 }

 const id = generateID();
 const todayISO = new Date().toISOString().slice(0,10);
 const today = new Date().toLocaleDateString('ar-EG');
 const effectiveStart = startDate || todayISO;
 const expiryDate = currentType === 'subscription' ? addDays(effectiveStart, duration) : null;

 const trainee = {
 id,
 name,
 phone,
 age,
 gender,
 type: currentType,
 sport: currentType === 'subscription' ? sport : 'تجريبي مجاني',
 plan: currentType === 'subscription' ? sport : 'تجريبي مجاني',
 startDate: effectiveStart,
 durationDays: currentType === 'subscription' ? parseInt(duration) : null,
 expiryDate,
 amount: currentType === 'subscription' ? (amount || 0) : 0,
 notes,
 status: currentType === 'subscription' ? 'نشط' : 'تجريبي',
 registrationDate: today,
 attendanceCount: 0
 };

 data.trainees.push(trainee);
 dbSetDoc(traineesCol, trainee.id, trainee);
 dbSaveCounter();

 // Add payment record if subscription
 if (currentType === 'subscription' && amount) {
 const payment = {
 id,
 name,
 type: 'اشتراك جديد',
 plan: sport,
 amount: parseInt(amount),
 method: 'نقداً',
 date: today,
 status: 'مكتمل'
 };
 data.payments.push(payment);
 dbAddDoc(paymentsCol, payment);
 }

 updateDashboard();
 updateTraineesTable();
 updateBadge();

 // Show ID
 document.getElementById('generated-id').textContent = id;
 document.getElementById('id-result').classList.add('show');

 showNotification(`تم تسجيل ${name} بنجاح!`);
 }

 function clearForm() {
 document.getElementById('reg-name').value = '';
 document.getElementById('reg-phone').value = '';
 document.getElementById('reg-age').value = '';
 document.getElementById('reg-sport').value = '';
 document.getElementById('reg-amount').value = '';
 document.getElementById('reg-notes').value = '';
 document.getElementById('id-result').classList.remove('show');
 }

 function daysLeft(t) {
 if (!t.expiryDate) return null;
 const today = new Date();
 today.setHours(0,0,0,0);
 const exp = new Date(t.expiryDate);
 exp.setHours(0,0,0,0);
 return Math.round((exp - today) / (1000 * 60 * 60 * 24));
 }

 function expiryCell(t) {
 if (t.type !== 'subscription') return '<span style="font-size:12px; color: rgba(48,56,65,0.4);">—</span>';
 const left = daysLeft(t);
 if (left === null) return '<span style="font-size:12px; color: rgba(48,56,65,0.4);">—</span>';
 if (left < 0) return '<span class="badge badge-danger">منتهي</span>';
 if (left <= 5) return `<span class="badge badge-warning">باقي ${left} يوم</span>`;
 return `<span style="font-size:12px;">${left} يوم</span>`;
 }

 function updateTraineesTable() {
 const tbody = document.getElementById('trainees-table');
 if (data.trainees.length === 0) {
 tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا يوجد متدربون مسجلون بعد</td></tr>';
 return;
 }

 tbody.innerHTML = data.trainees.map((t, i) => `
 <tr>
 <td><code style="color: var(--gold); font-family: monospace;">${t.id}</code></td>
 <td><strong>${t.name}</strong></td>
 <td>${t.phone}</td>
 <td>
 <span class="badge ${t.type === 'subscription' ? 'badge-success' : 'badge-test'}">
 ${t.type === 'subscription' ? 'اشتراك' : 'تجريبي'}
 </span>
 </td>
 <td style="font-size: 12px;">${t.sport || t.plan || '-'}</td>
 <td>
 <span class="badge ${t.status === 'نشط' ? 'badge-success' : t.status === 'تجريبي' ? 'badge-test' : 'badge-danger'}">
 ${t.status}
 </span>
 </td>
 <td>${expiryCell(t)}</td>
 <td>
 <button class="btn btn-outline btn-sm" onclick="viewTrainee(${i})">عرض</button>
 <button class="btn btn-outline btn-sm" onclick="editTrainee(${i})">تعديل</button>
 <button class="btn btn-outline btn-sm" onclick="printCard(${i})">طباعة</button>
 <button class="btn btn-danger btn-sm" onclick="deleteTrainee(${i})">حذف</button>
 </td>
 </tr>
 `).join('');
 }

 function searchTrainees() {
 const query = document.getElementById('search-trainees').value.toLowerCase();
 const filtered = data.trainees.filter(t =>
 t.name.toLowerCase().includes(query) ||
 t.id.toLowerCase().includes(query) ||
 t.phone.includes(query)
 );

 const tbody = document.getElementById('trainees-table');
 if (filtered.length === 0) {
 tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد نتائج</td></tr>';
 return;
 }

 tbody.innerHTML = filtered.map((t) => {
 const idx = data.trainees.indexOf(t);
 return `
 <tr>
 <td><code style="color: var(--gold); font-family: monospace;">${t.id}</code></td>
 <td><strong>${t.name}</strong></td>
 <td>${t.phone}</td>
 <td><span class="badge ${t.type === 'subscription' ? 'badge-success' : 'badge-test'}">${t.type === 'subscription' ? 'اشتراك' : 'تجريبي'}</span></td>
 <td style="font-size: 12px;">${t.sport || t.plan || '-'}</td>
 <td><span class="badge badge-success">${t.status}</span></td>
 <td>${expiryCell(t)}</td>
 <td>
 <button class="btn btn-outline btn-sm" onclick="viewTrainee(${idx})">عرض</button>
 <button class="btn btn-outline btn-sm" onclick="editTrainee(${idx})">تعديل</button>
 <button class="btn btn-outline btn-sm" onclick="printCard(${idx})">طباعة</button>
 </td>
 </tr>
 `;
 }).join('');
 }

 function viewTrainee(index) {
 const t = data.trainees[index];
 const attendanceCount = data.attendance.filter(a => a.id === t.id).length;

 document.getElementById('modal-title-text').textContent = `${t.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">الكود</div>
 <div style="color: var(--gold); font-family: monospace; font-size: 18px; font-weight: 700;">${t.id}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">الهاتف</div>
 <div style="font-weight: 600;">${t.phone}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">نوع الرياضة</div>
 <div style="font-weight: 600;">${t.sport || t.plan || '-'}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">تاريخ الانتهاء</div>
 <div style="font-weight: 600;">${t.expiryDate || '-'}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">باقي على انتهاء الاشتراك</div>
 <div style="font-weight: 600;">${expiryCell(t)}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">مرات الحضور</div>
 <div style="font-weight: 600; color: var(--success);">${attendanceCount} مرة</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">المدفوع</div>
 <div style="font-weight: 600; color: var(--warning);">${t.amount} ج.م</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">تاريخ التسجيل</div>
 <div style="font-weight: 600;">${t.registrationDate}</div>
 </div>
 </div>
 ${t.notes ? `<div style="margin-top: 15px; padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">ملاحظات</div>
 <div>${t.notes}</div>
 </div>` : ''}
 <div style="margin-top: 15px; display: flex; gap: 10px;">
 <button class="btn btn-outline btn-sm" onclick="closeModal(); editTrainee(${index})">تعديل البيانات</button>
 <button class="btn btn-outline btn-sm" onclick="printCard(${index})">طباعة البطاقة</button>
 </div>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function editTrainee(index) {
 const t = data.trainees[index];
 document.getElementById('modal-title-text').textContent = `تعديل بيانات ${t.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div class="form-grid">
 <div class="form-group">
 <label>الاسم الكامل</label>
 <input type="text" id="edit-name" value="${t.name}">
 </div>
 <div class="form-group">
 <label>رقم الهاتف</label>
 <input type="tel" id="edit-phone" value="${t.phone}">
 </div>
 <div class="form-group">
 <label>نوع الرياضة</label>
 <input type="text" id="edit-sport" value="${t.sport || t.plan || ''}">
 </div>
 <div class="form-group">
 <label>تاريخ بداية الاشتراك</label>
 <input type="date" id="edit-start-date" value="${t.startDate || ''}">
 </div>
 <div class="form-group">
 <label>مدة الاشتراك (بالأيام)</label>
 <input type="number" id="edit-duration" value="${t.durationDays || 30}">
 </div>
 <div class="form-group">
 <label>المبلغ المدفوع</label>
 <input type="number" id="edit-amount" value="${t.amount || 0}">
 </div>
 <div class="form-group">
 <label>الحالة</label>
 <select id="edit-status">
 <option value="نشط" ${t.status === 'نشط' ? 'selected' : ''}>نشط</option>
 <option value="منتهي" ${t.status === 'منتهي' ? 'selected' : ''}>منتهي</option>
 <option value="تجريبي" ${t.status === 'تجريبي' ? 'selected' : ''}>تجريبي</option>
 </select>
 </div>
 <div class="form-group">
 <label>ملاحظات</label>
 <input type="text" id="edit-notes" value="${t.notes || ''}">
 </div>
 </div>
 <button class="btn btn-primary" style="margin-top: 20px; width: 100%;" onclick="saveTraineeEdit(${index})">حفظ التعديلات</button>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function saveTraineeEdit(index) {
 const t = data.trainees[index];
 t.name = document.getElementById('edit-name').value.trim() || t.name;
 t.phone = document.getElementById('edit-phone').value.trim() || t.phone;
 t.sport = document.getElementById('edit-sport').value.trim();
 t.plan = t.sport;
 t.startDate = document.getElementById('edit-start-date').value || t.startDate;
 t.durationDays = parseInt(document.getElementById('edit-duration').value) || t.durationDays || 30;
 t.amount = parseInt(document.getElementById('edit-amount').value) || 0;
 t.status = document.getElementById('edit-status').value;
 t.notes = document.getElementById('edit-notes').value.trim();

 if (t.startDate && t.durationDays) {
 t.expiryDate = addDays(t.startDate, t.durationDays);
 }

 dbSetDoc(traineesCol, t.id, t);
 updateTraineesTable();
 updateDashboard();
 closeModal();
 showNotification(`تم حفظ تعديلات ${t.name}`);
 }

 function printCard(index) {
 const t = data.trainees[index];
 openCardWindow(t.id, t.name, t.sport || t.plan || '');
 }
 function deleteTrainee(index) {
 if (confirm('هل أنت متأكد من حذف هذا المتدرب؟')) {
 const t = data.trainees[index];
 data.trainees.splice(index, 1);
 dbDeleteDoc(traineesCol, t.id);
 updateTraineesTable();
 updateDashboard();
 updateBadge();
 showNotification('تم حذف المتدرب', 'danger');
 }
 }

 function printID() {
 const id = document.getElementById('generated-id').textContent;
 const trainee = data.trainees.find(t => t.id === id);
 const name = trainee ? trainee.name : '';
 const plan = trainee ? (trainee.sport || trainee.plan || '') : '';
 openCardWindow(id, name, plan);
 }

 function openCardWindow(id, name, plan) {
 const win = window.open('', '_blank');
 win.document.write(`
 <html dir="rtl" lang="ar"><head><title>بطاقة المتدرب - ${id}</title>
 <meta charset="UTF-8">
 <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
 <style>
 @page { size: 90mm 56mm; margin: 0; }
 * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
 body { background: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
 .card {
 width: 90mm; height: 56mm;
 background: #000000;
 border: 1px solid #E1DCC9;
 border-radius: 6px;
 padding: 5mm;
 display: flex;
 flex-direction: column;
 justify-content: space-between;
 color: #E1DCC9;
 }
 .card-top { display: flex; justify-content: space-between; align-items: flex-start; }
 .club-name { font-size: 13px; font-weight: 700; letter-spacing: 2px; }
 .club-sub { font-size: 8px; color: rgba(225,220,201,0.6); margin-top: 2px; }
 .card-body { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
 .card-info { flex: 1; }
 .member-name { font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px; }
 .member-plan { font-size: 9px; color: rgba(225,220,201,0.7); margin-bottom: 6px; }
 .member-code { font-size: 13px; font-family: 'Courier New', monospace; letter-spacing: 1px; color: #E1DCC9; }
 .qr-box { background: #ffffff; padding: 3px; border-radius: 4px; line-height: 0; }
 .card-footer { font-size: 7px; color: rgba(225,220,201,0.5); text-align: center; border-top: 1px solid rgba(225,220,201,0.2); padding-top: 3px; }
 </style>
 </head>
 <body>
 <div class="card">
 <div class="card-top">
 <div>
 <div class="club-name">Academy Name</div>
 <div class="club-sub">بطاقة عضوية</div>
 </div>
 </div>
 <div class="card-body">
 <div class="card-info">
 <div class="member-name">${name}</div>
 <div class="member-plan">${plan}</div>
 <div class="member-code">${id}</div>
 </div>
 <div class="qr-box" id="qrcode"></div>
 </div>
 <div class="card-footer">يُستخدم هذا الكود لتسجيل الحضور عند الدخول</div>
 </div>
 <script>
 window.onload = function() {
 new QRCode(document.getElementById("qrcode"), {
 text: "${id}",
 width: 90,
 height: 90,
 colorDark: "#000000",
 colorLight: "#ffffff"
 });
 setTimeout(function() { window.print(); }, 300);
 };
 <\/script>
 </body></html>
 `);
 win.document.close();
 }

 // ==================== ATTENDANCE ====================
 function recordAttendance() {
 const code = document.getElementById('attendance-code').value.trim().toUpperCase();
 const resultDiv = document.getElementById('attendance-result');

 if (!code) {
 showNotification('يرجى إدخال كود المتدرب', 'warning');
 return;
 }

 const trainee = data.trainees.find(t => t.id === code);
 const resultName = document.getElementById('attendance-result-name');
 const resultMsg = document.getElementById('attendance-result-msg');

 if (!trainee) {
 resultDiv.className = 'attendance-result error';
 resultName.textContent = 'كود غير موجود!';
 resultMsg.textContent = `الكود "${code}" غير مسجل في النظام`;
 return;
 }

 // Check if already checked in today
 const today = new Date().toLocaleDateString('ar-EG');
 const alreadyCheckedIn = data.attendance.some(
 a => a.id === code && a.date === today
 );

 if (alreadyCheckedIn) {
 resultDiv.className = 'attendance-result error';
 resultName.textContent = trainee.name;
 resultMsg.textContent = 'تم تسجيل حضور هذا المتدرب مسبقاً اليوم';
 return;
 }

 const now = new Date();
 const time = now.toLocaleTimeString('ar-EG');

 const attendanceEntry = {
 id: code,
 name: trainee.name,
 date: today,
 time,
 status: 'حاضر'
 };
 data.attendance.push(attendanceEntry);
 dbAddDoc(attendanceCol, attendanceEntry);

 resultDiv.className = 'attendance-result success';
 resultName.textContent = trainee.name;
 resultMsg.textContent = `تم تسجيل الحضور بنجاح - ${time}`;

 document.getElementById('attendance-code').value = '';
 updateAttendanceLog();
 showNotification(`تم تسجيل حضور ${trainee.name}`);
 }

 function updateAttendanceLog() {
 const today = new Date().toLocaleDateString('ar-EG');
 const todayAttendance = data.attendance.filter(a => a.date === today);

 document.getElementById('today-present').textContent = todayAttendance.length;

 const totalActive = data.trainees.filter(t => t.status === 'نشط').length;
 const absent = Math.max(0, totalActive - todayAttendance.length);
 document.getElementById('today-absent').textContent = absent;

 const rate = totalActive > 0 ? Math.round((todayAttendance.length / totalActive) * 100) : 0;
 document.getElementById('attendance-rate').textContent = `${rate}%`;

 const tbody = document.getElementById('attendance-log');
 if (todayAttendance.length === 0) {
 tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد سجلات حضور لليوم</td></tr>';
 return;
 }

 tbody.innerHTML = todayAttendance.map((a, i) => `
 <tr>
 <td>${i + 1}</td>
 <td><code style="color: var(--gold); font-family: monospace;">${a.id}</code></td>
 <td>${a.name}</td>
 <td>${a.time}</td>
 <td><span class="badge badge-success">حاضر</span></td>
 </tr>
 `).join('');
 }

 // ==================== FINANCIAL ====================
 function searchTraineeForRenewal() {
 const code = document.getElementById('renew-code').value.trim().toUpperCase();
 const trainee = data.trainees.find(t => t.id === code);
 document.getElementById('renew-name').value = trainee ? trainee.name : '';
 }

 function renewSubscription() {
 const code = document.getElementById('renew-code').value.trim().toUpperCase();
 const duration = document.getElementById('renew-duration').value || 30;
 const amount = document.getElementById('renew-amount').value;
 const method = document.getElementById('renew-method').value;
 const date = document.getElementById('renew-date').value;

 if (!code || !amount) {
 showNotification('يرجى ملء جميع البيانات', 'warning');
 return;
 }

 const trainee = data.trainees.find(t => t.id === code);
 if (!trainee) {
 showNotification('الكود غير موجود', 'danger');
 return;
 }

 const today = new Date().toLocaleDateString('ar-EG');
 const todayISO = new Date().toISOString().slice(0,10);

 const payment = {
 id: code,
 name: trainee.name,
 type: 'تجديد',
 plan: trainee.sport || trainee.plan,
 amount: parseInt(amount),
 method,
 date: date || today,
 status: 'مكتمل'
 };
 data.payments.push(payment);
 dbAddDoc(paymentsCol, payment);

 // Extend from current expiry if still active, otherwise from today
 const base = (trainee.expiryDate && new Date(trainee.expiryDate) > new Date()) ? trainee.expiryDate : todayISO;
 trainee.expiryDate = addDays(base, duration);
 trainee.durationDays = parseInt(duration);
 trainee.status = 'نشط';
 dbSetDoc(traineesCol, trainee.id, trainee);
 updateFinancial();
 updateTraineesTable();
 updateDashboard();

 document.getElementById('renew-code').value = '';
 document.getElementById('renew-name').value = '';
 document.getElementById('renew-amount').value = '';

 showNotification(`تم تجديد اشتراك ${trainee.name} بنجاح!`);
 }

 function updateFinancial() {
 const totalIncome = data.payments.reduce((sum, p) => sum + p.amount, 0);
 const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
 const totalSalaries = data.expenses.filter(e => e.type === 'مرتب').reduce((sum, e) => sum + e.amount, 0);
 const allExpenses = totalExpenses;

 document.getElementById('fin-income').textContent = `${totalIncome.toLocaleString()} ج.م`;
 document.getElementById('fin-expenses').textContent = `${allExpenses.toLocaleString()} ج.م`;
 document.getElementById('fin-profit').textContent = `${(totalIncome - allExpenses).toLocaleString()} ج.م`;

 const tbody = document.getElementById('payments-table');
 if (data.payments.length === 0) {
 tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد مدفوعات مسجلة</td></tr>';
 return;
 }

 tbody.innerHTML = data.payments.map(p => `
 <tr>
 <td><code style="color: var(--gold); font-family: monospace;">${p.id}</code></td>
 <td>${p.name}</td>
 <td><span class="badge ${p.type === 'تجديد' ? 'badge-info' : 'badge-success'}">${p.type}</span></td>
 <td style="font-size: 12px;">${p.plan}</td>
 <td style="color: var(--success); font-weight: 700;">${p.amount.toLocaleString()} ج.م</td>
 <td>${p.method}</td>
 <td>${p.date}</td>
 <td><span class="badge badge-success">${p.status}</span></td>
 </tr>
 `).join('');
 }

 // ==================== SALARIES ====================
 function addEmployee() {
 const name = document.getElementById('emp-name').value.trim();
 const role = document.getElementById('emp-role').value;
 const salary = document.getElementById('emp-salary').value;

 if (!name || !salary) {
 showNotification('يرجى ملء جميع البيانات', 'warning');
 return;
 }

 const employee = {
 id: `EMP-${Date.now()}`,
 name,
 role,
 salary: parseInt(salary),
 status: 'نشط',
 joinDate: new Date().toLocaleDateString('ar-EG')
 };
 data.employees.push(employee);
 dbSetDoc(employeesCol, employee.id, employee);
 updateSalaries();

 document.getElementById('emp-name').value = '';
 document.getElementById('emp-salary').value = '';
 showNotification(`تم إضافة ${name} بنجاح!`);
 }

 function addExpense() {
 const type = document.getElementById('expense-type').value;
 const desc = document.getElementById('expense-desc').value;
 const amount = document.getElementById('expense-amount').value;

 if (!amount) {
 showNotification('يرجى إدخال المبلغ', 'warning');
 return;
 }

 const expense = {
 id: `EXP-${Date.now()}`,
 type,
 desc,
 amount: parseInt(amount),
 date: new Date().toLocaleDateString('ar-EG')
 };
 data.expenses.push(expense);
 dbSetDoc(expensesCol, expense.id, expense);
 updateSalaries();
 updateFinancial();

 document.getElementById('expense-desc').value = '';
 document.getElementById('expense-amount').value = '';
 showNotification('تم تسجيل المصروف بنجاح!');
 }

 function updateSalaries() {
 const empTbody = document.getElementById('employees-table');
 if (data.employees.length === 0) {
 empTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا يوجد موظفون مسجلون</td></tr>';
 } else {
 empTbody.innerHTML = data.employees.map((e, i) => `
 <tr>
 <td>${i + 1}</td>
 <td><strong>${e.name}</strong></td>
 <td>${e.role}</td>
 <td style="color: var(--warning); font-weight: 700;">${e.salary.toLocaleString()} ج.م</td>
 <td><span class="badge badge-success">${e.status}</span></td>
 <td>
 <button class="btn btn-success btn-sm" onclick="paySalary(${i})">صرف</button>
 <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${i})">حذف</button>
 </td>
 </tr>
 `).join('');
 }

 const expTbody = document.getElementById('expenses-table');
 if (data.expenses.length === 0) {
 expTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد مصروفات مسجلة</td></tr>';
 } else {
 expTbody.innerHTML = data.expenses.map((e, i) => `
 <tr>
 <td>${i + 1}</td>
 <td><span class="badge badge-warning">${e.type}</span></td>
 <td>${e.desc || '-'}</td>
 <td style="color: var(--danger); font-weight: 700;">${e.amount.toLocaleString()} ج.م</td>
 <td>${e.date}</td>
 </tr>
 `).join('');
 }
 }

 function paySalary(index) {
 const emp = data.employees[index];
 const today = new Date().toLocaleDateString('ar-EG');

 const expense = {
 id: `SAL-${Date.now()}`,
 type: 'مرتب',
 desc: `راتب ${emp.name} (${emp.role})`,
 amount: emp.salary,
 date: today
 };
 data.expenses.push(expense);
 dbSetDoc(expensesCol, expense.id, expense);
 updateSalaries();
 updateFinancial();
 updateReports();

 showNotification(`تم صرف راتب ${emp.name}: ${emp.salary.toLocaleString()} ج.م`);
 }

 function deleteEmployee(index) {
 if (confirm('هل تريد حذف هذا الموظف؟')) {
 const emp = data.employees[index];
 data.employees.splice(index, 1);
 dbDeleteDoc(employeesCol, emp.id);
 updateSalaries();
 }
 }

 // ==================== DASHBOARD ====================
 function updateDashboard() {
 const total = data.trainees.length;
 const active = data.trainees.filter(t => t.status === 'نشط').length;
 const tests = data.trainees.filter(t => t.type === 'test').length;
 const revenue = data.payments.reduce((sum, p) => sum + p.amount, 0);

 document.getElementById('dash-total').textContent = total;
 document.getElementById('dash-active').textContent = active;
 document.getElementById('dash-test').textContent = tests;
 document.getElementById('dash-revenue').textContent = revenue.toLocaleString();

 // Expiry alerts
 const expiring = data.trainees.filter(t => {
 if (t.type !== 'subscription' || t.status !== 'نشط') return false;
 const left = daysLeft(t);
 return left !== null && left <= 5;
 }).sort((a, b) => daysLeft(a) - daysLeft(b));

 const alertsCard = document.getElementById('alerts-card');
 const alertsBox = document.getElementById('expiry-alerts');
 if (expiring.length === 0) {
 alertsCard.style.display = 'none';
 } else {
 alertsCard.style.display = 'block';
 alertsBox.innerHTML = expiring.map(t => {
 const left = daysLeft(t);
 const msg = left < 0 ? 'منتهي الاشتراك' : (left === 0 ? 'ينتهي اليوم' : `باقي ${left} يوم على الانتهاء`);
 const cls = left < 0 ? 'badge-danger' : 'badge-warning';
 return `
 <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background: rgba(48,56,65,0.04); border-radius:10px;">
 <div>
 <strong>${t.name}</strong>
 <span style="font-size:12px; color: rgba(48,56,65,0.5); margin-right:8px;">${t.id}</span>
 </div>
 <span class="badge ${cls}">${msg}</span>
 </div>`;
 }).join('');
 }

 // Recent registrations
 const recent = data.trainees.slice(-5).reverse();
 const tbody = document.getElementById('recent-registrations');

 if (recent.length === 0) {
 tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد تسجيلات بعد</td></tr>';
 return;
 }

 tbody.innerHTML = recent.map(t => `
 <tr>
 <td><code style="color: var(--gold); font-family: monospace; font-size: 12px;">${t.id}</code></td>
 <td>${t.name}</td>
 <td><span class="badge ${t.type === 'subscription' ? 'badge-success' : 'badge-test'}">${t.type === 'subscription' ? 'اشتراك' : 'تجريبي'}</span></td>
 <td><span class="badge badge-success">${t.status}</span></td>
 <td>${expiryCell(t)}</td>
 </tr>
 `).join('');
 }

 function updateBadge() {
 document.getElementById('reg-badge').textContent = data.trainees.length;
 }

 // ==================== REPORTS ====================
 function updateReports() {
 const total = data.trainees.length;
 const active = data.trainees.filter(t => t.status === 'نشط').length;
 const tests = data.trainees.filter(t => t.type === 'test').length;
 const totalIncome = data.payments.reduce((sum, p) => sum + p.amount, 0);
 const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
 const totalSalaries = data.expenses.filter(e => e.type === 'مرتب').reduce((sum, e) => sum + e.amount, 0);
 const totalAttendance = data.attendance.length;

 document.getElementById('members-report').innerHTML = `
 ${reportItem('إجمالي المتدربين', total)}
 ${reportItem('اشتراكات نشطة', active, 'var(--success)')}
 ${reportItem('جلسات تجريبية', tests, 'var(--gold)')}
 ${reportItem('نسبة التحويل', total > 0 ? `${Math.round((active/total)*100)}%` : '0%', 'var(--warning)')}
 `;

 document.getElementById('financial-report').innerHTML = `
 ${reportItem('إجمالي الإيرادات', `${totalIncome.toLocaleString()} ج.م`, 'var(--success)')}
 ${reportItem('المصروفات', `${totalExpenses.toLocaleString()} ج.م`, 'var(--danger)')}
 ${reportItem('مرتبات مصروفة', `${totalSalaries.toLocaleString()} ج.م`, 'var(--warning)')}
 ${reportItem('صافي الربح', `${(totalIncome - totalExpenses).toLocaleString()} ج.م`, 'var(--gold)')}
 `;

 document.getElementById('attendance-report').innerHTML = `
 ${reportItem('إجمالي سجلات الحضور', totalAttendance)}
 ${reportItem('أيام التشغيل', [...new Set(data.attendance.map(a => a.date))].length)}
 ${reportItem('متوسط الحضور اليومي', totalAttendance > 0 ? Math.round(totalAttendance / Math.max(1, [...new Set(data.attendance.map(a => a.date))].length)) : 0)}
 `;
 }

 function reportItem(label, value, color = 'white') {
 return `
 <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: rgba(48,56,65,0.03); border-radius: 8px;">
 <span style="color: rgba(48,56,65,0.6); font-size: 13px;">${label}</span>
 <span style="font-weight: 700; color: ${color};">${value}</span>
 </div>
 `;
 }

 function reportDoc(title, bodyHtml) {
 const win = window.open('', '_blank');
 win.document.write(`
 <html dir="rtl" lang="ar"><head><title>${title}</title>
 <meta charset="UTF-8">
 <style>
 * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
 body { background: #ffffff; color: #1B2433; padding: 30px 40px; }
 .report-header {
 display: flex; justify-content: space-between; align-items: flex-end;
 border-bottom: 3px solid #2F6690; padding-bottom: 14px; margin-bottom: 20px;
 }
 .academy-name { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #1B2433; }
 .report-meta { text-align: left; font-size: 12px; color: #6b7280; }
 .report-title { font-size: 17px; font-weight: 700; color: #2F6690; margin: 18px 0 10px; }
 .summary-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
 .summary-box {
 flex: 1; min-width: 140px; border: 1px solid #e3e6eb; border-radius: 8px;
 padding: 10px 14px; background: #f7f9fb;
 }
 .summary-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
 .summary-value { font-size: 16px; font-weight: 700; color: #1B2433; }
 table { width: 100%; border-collapse: collapse; margin-bottom: 26px; font-size: 12px; }
 th, td { border: 1px solid #e3e6eb; padding: 8px 10px; text-align: right; }
 th { background: #1B2433; color: #ffffff; font-weight: 600; }
 tbody tr:nth-child(even) { background: #f7f9fb; }
 .section-block { page-break-inside: avoid; }
 .report-footer { margin-top: 10px; font-size: 11px; color: #9aa1ab; text-align: center; }
 @media print { .summary-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
 th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
 </style>
 </head>
 <body>
 <div class="report-header">
 <div class="academy-name">Academy</div>
 <div class="report-meta">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
 </div>
 ${bodyHtml}
 <div class="report-footer">تم إنشاء هذا التقرير تلقائياً من نظام إدارة الأكاديمية</div>
 <script>
 window.onload = function() { setTimeout(function() { window.print(); }, 250); };
 <\/script>
 </body></html>
 `);
 win.document.close();
 }

 function summaryBox(label, value) {
 return `<div class="summary-box"><div class="summary-label">${label}</div><div class="summary-value">${value}</div></div>`;
 }

 function buildMembersReport() {
 const total = data.trainees.length;
 const active = data.trainees.filter(t => t.status === 'نشط').length;
 const tests = data.trainees.filter(t => t.type === 'test').length;
 const conv = total > 0 ? `${Math.round((active/total)*100)}%` : '0%';

 const rows = data.trainees.map(t => `
 <tr>
 <td>${t.id}</td>
 <td>${t.name}</td>
 <td>${t.phone}</td>
 <td>${t.type === 'subscription' ? 'اشتراك' : 'تجريبي'}</td>
 <td>${t.sport || t.plan || '-'}</td>
 <td>${t.status}</td>
 <td>${t.expiryDate || '-'}</td>
 </tr>
 `).join('') || '<tr><td colspan="7" style="text-align:center; color:#9aa1ab;">لا يوجد متدربون</td></tr>';

 return `
 <div class="section-block">
 <div class="report-title">تقرير المتدربين</div>
 <div class="summary-row">
 ${summaryBox('إجمالي المتدربين', total)}
 ${summaryBox('اشتراكات نشطة', active)}
 ${summaryBox('جلسات تجريبية', tests)}
 ${summaryBox('نسبة التحويل', conv)}
 </div>
 <table>
 <thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>النوع</th><th>الرياضة</th><th>الحالة</th><th>تاريخ الانتهاء</th></tr></thead>
 <tbody>${rows}</tbody>
 </table>
 </div>
 `;
 }

 function buildFinancialReport() {
 const totalIncome = data.payments.reduce((sum, p) => sum + p.amount, 0);
 const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
 const totalSalaries = data.expenses.filter(e => e.type === 'مرتب').reduce((sum, e) => sum + e.amount, 0);
 const net = totalIncome - totalExpenses;

 const paymentRows = data.payments.map(p => `
 <tr>
 <td>${p.id}</td>
 <td>${p.name}</td>
 <td>${p.type}</td>
 <td>${p.plan}</td>
 <td>${p.amount.toLocaleString()} ج.م</td>
 <td>${p.method}</td>
 <td>${p.date}</td>
 </tr>
 `).join('') || '<tr><td colspan="7" style="text-align:center; color:#9aa1ab;">لا يوجد مدفوعات</td></tr>';

 const expenseRows = data.expenses.map(e => `
 <tr>
 <td>${e.id}</td>
 <td>${e.type}</td>
 <td>${e.desc}</td>
 <td>${e.amount.toLocaleString()} ج.م</td>
 <td>${e.date}</td>
 </tr>
 `).join('') || '<tr><td colspan="5" style="text-align:center; color:#9aa1ab;">لا يوجد مصروفات</td></tr>';

 const salaryRows = data.employees.map(e => `
 <tr>
 <td>${e.id}</td>
 <td>${e.name}</td>
 <td>${e.role}</td>
 <td>${e.salary.toLocaleString()} ج.م</td>
 <td>${e.status}</td>
 </tr>
 `).join('') || '<tr><td colspan="5" style="text-align:center; color:#9aa1ab;">لا يوجد موظفون</td></tr>';

 return `
 <div class="section-block">
 <div class="report-title">التقرير المالي</div>
 <div class="summary-row">
 ${summaryBox('إجمالي الإيرادات', `${totalIncome.toLocaleString()} ج.م`)}
 ${summaryBox('المصروفات', `${totalExpenses.toLocaleString()} ج.م`)}
 ${summaryBox('مرتبات مصروفة', `${totalSalaries.toLocaleString()} ج.م`)}
 ${summaryBox('صافي الربح', `${net.toLocaleString()} ج.م`)}
 </div>
 <table>
 <thead><tr><th colspan="7" style="text-align:right; background:#2F6690;">المدفوعات</th></tr><tr><th>الكود</th><th>الاسم</th><th>نوع العملية</th><th>الرياضة</th><th>المبلغ</th><th>طريقة الدفع</th><th>التاريخ</th></tr></thead>
 <tbody>${paymentRows}</tbody>
 </table>
 <table>
 <thead><tr><th colspan="5" style="text-align:right; background:#2F6690;">المصروفات</th></tr><tr><th>الكود</th><th>النوع</th><th>الوصف</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
 <tbody>${expenseRows}</tbody>
 </table>
 </div>
 `;
 }

 function buildAttendanceReport() {
 const totalAttendance = data.attendance.length;
 const days = [...new Set(data.attendance.map(a => a.date))].length;
 const avg = totalAttendance > 0 ? Math.round(totalAttendance / Math.max(1, days)) : 0;

 const rows = data.attendance.map(a => `
 <tr>
 <td>${a.id}</td>
 <td>${a.name}</td>
 <td>${a.date}</td>
 <td>${a.time}</td>
 <td>${a.status}</td>
 </tr>
 `).join('') || '<tr><td colspan="5" style="text-align:center; color:#9aa1ab;">لا يوجد سجلات حضور</td></tr>';

 return `
 <div class="section-block">
 <div class="report-title">تقرير الحضور</div>
 <div class="summary-row">
 ${summaryBox('إجمالي سجلات الحضور', totalAttendance)}
 ${summaryBox('أيام التشغيل', days)}
 ${summaryBox('متوسط الحضور اليومي', avg)}
 </div>
 <table>
 <thead><tr><th>الكود</th><th>الاسم</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th></tr></thead>
 <tbody>${rows}</tbody>
 </table>
 </div>
 `;
 }

 function exportReport(type) {
 if (type === 'members') reportDoc('تقرير المتدربين', buildMembersReport());
 else if (type === 'financial') reportDoc('التقرير المالي', buildFinancialReport());
 else if (type === 'attendance') reportDoc('تقرير الحضور', buildAttendanceReport());
 }

 function printReport() {
 const body = buildMembersReport() + buildFinancialReport() + buildAttendanceReport();
 reportDoc('التقرير الشامل', body);
 }

 function exportData() {
 const csv = data.trainees.map(t =>
 `${t.id},${t.name},${t.phone},${t.type},${t.plan},${t.status},${t.registrationDate}`
 ).join('\n');

 const header = 'الكود,الاسم,الهاتف,النوع,الخطة,الحالة,التاريخ\n';
 const blob = new Blob(['\uFEFF' + header + csv], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'trainees.csv';
 a.click();
 }

 // ==================== UTILITIES ====================
 function closeModal() {
 document.getElementById('modal-overlay').classList.remove('show');
 }

 function showNotification(text, type = 'success') {
 const notif = document.getElementById('notification');
 const colors = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' };

 notif.style.borderRightColor = colors[type];
 document.getElementById('notif-text').textContent = text;
 notif.classList.add('show');

 setTimeout(() => notif.classList.remove('show'), 3000);
 }

 function updateDateTime() {
 const now = new Date();
 document.getElementById('current-date').textContent =
 now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
 }

 // ==================== INIT ====================
 document.addEventListener('DOMContentLoaded', async () => {
 const overlay = document.getElementById('loading-overlay');

 await loadData();

 if (overlay) overlay.classList.add('hidden');

 updateDateTime();
 setInterval(updateDateTime, 60000);
 updateDashboard();
 updateBadge();

 // Set today's date
 document.getElementById('reg-start-date').valueAsDate = new Date();
 document.getElementById('renew-date').valueAsDate = new Date();
 });

 // Close modal on overlay click
 document.getElementById('modal-overlay').addEventListener('click', function(e) {
 if (e.target === this) closeModal();
 });

 // Enter key for attendance
 document.addEventListener('keypress', function(e) {
 if (e.key === 'Enter' && document.getElementById('attendance-code') === document.activeElement) {
 recordAttendance();
 }
 });
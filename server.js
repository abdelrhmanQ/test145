 // ====================================================================
 // server.js
 // ----------------------------------------------------------------------
 // Data layer: Firebase setup, Firestore collections, and all the
 // read/write helpers the app uses to talk to the database.
 // NOTE: this still runs in the visitor's browser like main.js does -
 // it is not a separate backend process. It's just split into its own
 // file to keep "data/Firestore" code separate from "UI" code (main.js).
 // Load order in index.html must be: firebase SDK -> server.js -> main.js
 // ====================================================================

 // ==================== FIREBASE SETUP ====================
 const firebaseConfig = {
 apiKey: "AIzaSyD3XUNapMy7A4_P7-P53PtdF3noSAIG-K0",
 authDomain: "nacademy-c11a9.firebaseapp.com",
 projectId: "nacademy-c11a9",
 storageBucket: "nacademy-c11a9.firebasestorage.app",
 messagingSenderId: "639306451600",
 appId: "1:639306451600:web:9647a04a02b0a61ba52615",
 measurementId: "G-N5D4880NEE"
 };

 firebase.initializeApp(firebaseConfig);
 const db = firebase.firestore();

 // Firestore collections - one per data type, instead of one giant blob
 const traineesCol = db.collection('trainees');
 const attendanceCol = db.collection('attendance');
 const paymentsCol = db.collection('payments');
 const employeesCol = db.collection('employees');
 const expensesCol = db.collection('expenses');
 const metaDoc = db.collection('meta').doc('counter');

 // ==================== DATA STORE ====================
 let data = {
 trainees: [],
 attendance: [],
 payments: [],
 employees: [],
 expenses: [],
 counter: 1
 };

 // Keep a local copy too, so the app still opens (read-only) if the
 // connection drops, and so the first paint isn't blank while Firestore loads.
 function cacheLocally() {
 try {
 localStorage.setItem('racer-data', JSON.stringify(data));
 } catch (e) { /* storage full or unavailable - not critical */ }
 }

 // Load everything from Firestore. If Firestore is empty (first time this
 // site is connected to the database) but old localStorage data exists,
 // that local data is pushed up to Firestore once, so nothing is lost.
 async function loadData() {
 try {
 const [traineesSnap, attendanceSnap, paymentsSnap, employeesSnap, expensesSnap, counterSnap] =
 await Promise.all([
 traineesCol.get(), attendanceCol.get(), paymentsCol.get(),
 employeesCol.get(), expensesCol.get(), metaDoc.get()
 ]);

 const hasCloudData = !traineesSnap.empty || !attendanceSnap.empty ||
 !paymentsSnap.empty || !employeesSnap.empty || !expensesSnap.empty || counterSnap.exists;

 if (hasCloudData) {
 data.trainees = traineesSnap.docs.map(d => d.data());
 data.attendance = attendanceSnap.docs.map(d => d.data());
 data.payments = paymentsSnap.docs.map(d => d.data());
 data.employees = employeesSnap.docs.map(d => d.data());
 data.expenses = expensesSnap.docs.map(d => d.data());
 data.counter = counterSnap.exists ? counterSnap.data().value : (data.trainees.length + 1);
 } else {
 const saved = localStorage.getItem('racer-data');
 if (saved) {
 const localData = JSON.parse(saved);
 data = Object.assign({ trainees: [], attendance: [], payments: [], employees: [], expenses: [], counter: 1 }, localData);
 await migrateLocalDataToFirestore(data);
 showNotification('تم رفع البيانات المحفوظة محلياً إلى قاعدة البيانات بنجاح');
 }
 }

 cacheLocally();
 } catch (err) {
 console.error('Firestore load error:', err);
 const saved = localStorage.getItem('racer-data');
 if (saved) data = JSON.parse(saved);
 showNotification('تعذر الاتصال بقاعدة البيانات، يتم عرض آخر نسخة محفوظة محلياً', 'danger');
 }
 }

 // One-time migration of any pre-existing local data into Firestore,
 // batched safely under Firestore's 500-writes-per-batch limit.
 async function migrateLocalDataToFirestore(localData) {
 const ops = [];
 (localData.trainees || []).forEach(t => ops.push(['set', traineesCol.doc(t.id), t]));
 (localData.attendance || []).forEach(a => ops.push(['add', attendanceCol, a]));
 (localData.payments || []).forEach(p => ops.push(['add', paymentsCol, p]));
 (localData.employees || []).forEach(e => ops.push(['set', employeesCol.doc(e.id), e]));
 (localData.expenses || []).forEach(e => ops.push(['set', expensesCol.doc(e.id), e]));

 for (let i = 0; i < ops.length; i += 450) {
 const batch = db.batch();
 ops.slice(i, i + 450).forEach(([kind, refOrCol, obj]) => {
 if (kind === 'set') batch.set(refOrCol, obj);
 else batch.set(refOrCol.doc(), obj);
 });
 await batch.commit();
 }

 await metaDoc.set({ value: localData.counter || 1 });
 }

 // Write helpers - update the cloud, and always keep the local cache in sync
 // immediately so the UI never waits on the network.
 async function dbSetDoc(colRef, id, obj) {
 cacheLocally();
 try {
 await colRef.doc(id).set(obj);
 } catch (err) {
 console.error('Firestore set error:', err);
 showNotification('تم الحفظ محلياً، لكن تعذر رفعه لقاعدة البيانات. تحقق من الاتصال', 'danger');
 }
 }

 async function dbAddDoc(colRef, obj) {
 cacheLocally();
 try {
 await colRef.add(obj);
 } catch (err) {
 console.error('Firestore add error:', err);
 showNotification('تم الحفظ محلياً، لكن تعذر رفعه لقاعدة البيانات. تحقق من الاتصال', 'danger');
 }
 }

 async function dbDeleteDoc(colRef, id) {
 cacheLocally();
 try {
 await colRef.doc(id).delete();
 } catch (err) {
 console.error('Firestore delete error:', err);
 showNotification('تعذر الحذف من قاعدة البيانات السحابية', 'danger');
 }
 }

 async function dbSaveCounter() {
 cacheLocally();
 try {
 await metaDoc.set({ value: data.counter });
 } catch (err) {
 console.error('Firestore counter error:', err);
 }
 }


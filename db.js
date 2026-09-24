/* db.js - Firebase Authentication + Firestore persistence */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

(function(window){
  const firebaseConfig = {
    apiKey: 'AIzaSyANXwNluvKE9GltgaZvccTNjHF5PCmor4M',
    authDomain: 'genalsat-13.firebaseapp.com',
    projectId: 'genalsat-13',
    storageBucket: 'genalsat-13.firebasestorage.app',
    messagingSenderId: '741995913327',
    appId: '1:741995913327:web:f307bef632be8ae9902d9a'
  };
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  const googleProvider = new GoogleAuthProvider();
  let currentUser = null;
  let legacyMigrationChecked = false;
  let driveTokenClient = null;
  let driveTokenPromise = null;
  let authReadyResolve;
  const authReady = new Promise(resolve=>{ authReadyResolve = resolve; });

  function showLogin(){
    if(document.getElementById('firebase-login')) return;
    const modal = document.createElement('div');
    modal.id = 'firebase-login';
    modal.className = 'firebase-login';
    modal.innerHTML = `<div class="firebase-login-card">
      <h2>Acceso a GenalSAT</h2>
      <p>Inicia sesión con Google para acceder a tus datos de Firestore.</p>
      <button type="button" class="btn" id="firebase-google-login">Continuar con Google</button>
      <p class="firebase-login-error" id="firebase-login-error" hidden></p>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#firebase-google-login').addEventListener('click', async event=>{
      const button = event.currentTarget;
      const error = modal.querySelector('#firebase-login-error');
      button.disabled = true;
      button.textContent = 'Conectando...';
      error.hidden = true;
      try{
        await signInWithPopup(auth, googleProvider);
      }catch(signInError){
        console.error('No se pudo iniciar sesión con Google.', signInError);
        error.textContent = 'No se pudo iniciar sesión. Revisa la configuración de Authentication en Firebase.';
        error.hidden = false;
        button.disabled = false;
        button.textContent = 'Continuar con Google';
      }
    });
  }

  onAuthStateChanged(auth, user=>{
    currentUser = user;
    if(user) document.getElementById('firebase-login')?.remove();
    else showLogin();
    if(user) authReadyResolve(user);
  });

  function requireUser(){
    return authReady.then(user=>{
      if(!user) throw new Error('Se requiere una sesión de Google para acceder a Firestore.');
      return user;
    });
  }

  function cleanData(value){
    if(Array.isArray(value)) return value.map(cleanData);
    if(value && typeof value === 'object'){
      const result = {};
      Object.entries(value).forEach(([key,item])=>{
        if(item !== undefined) result[key] = cleanData(item);
      });
      return result;
    }
    return value;
  }

  function storeRef(store){
    return collection(firestore, 'users', currentUser.uid, store);
  }

  async function openDB(){
    await requireUser();
    await migrateLegacyData();
    return firestore;
  }

  async function getAll(store){
    await requireUser();
    const snapshot = await getDocs(storeRef(store));
    return snapshot.docs.map(item=>({id:item.data().id ?? item.id, ...item.data()}));
  }

  async function get(store, key){
    await requireUser();
    const snapshot = await getDoc(doc(storeRef(store), String(key)));
    return snapshot.exists() ? {id:snapshot.data().id ?? key, ...snapshot.data()} : undefined;
  }

  function createId(){
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }

  function readLegacyStore(store){
    return new Promise((resolve,reject)=>{
      const request = indexedDB.open('genalsat-db');
      request.onerror = ()=>reject(request.error);
      request.onsuccess = event=>{
        const legacyDb = event.target.result;
        if(!legacyDb.objectStoreNames.contains(store)){
          legacyDb.close();
          resolve([]);
          return;
        }
        const readRequest = legacyDb.transaction(store,'readonly').objectStore(store).getAll();
        readRequest.onsuccess = ()=>{
          legacyDb.close();
          resolve(readRequest.result || []);
        };
        readRequest.onerror = ()=>{
          legacyDb.close();
          reject(readRequest.error);
        };
      };
    });
  }

  async function migrateLegacyData(){
    if(legacyMigrationChecked) return;
    legacyMigrationChecked = true;
    const stores = ['products','clients','parts','budgets','invoices','settings','moves','appointments'];
    const cloudCounts = await Promise.all(stores.map(async store=>(await getDocs(storeRef(store))).size));
    if(cloudCounts.some(count=>count > 0)) return;
    const legacyData = {};
    for(const store of stores) legacyData[store] = await readLegacyStore(store);
    const hasLegacyData = stores.some(store=>legacyData[store].length);
    if(!hasLegacyData) return;
    for(const store of stores){
      for(const record of legacyData[store]){
        if(store === 'settings') await put(store, record);
        else await add(store, record);
      }
    }
  }

  async function add(store, value){
    await requireUser();
    const record = cleanData({...value});
    if(record.id === undefined || record.id === null) record.id = createId();
    await setDoc(doc(storeRef(store), String(record.id)), record);
    return record.id;
  }

  async function put(store, value){
    await requireUser();
    const record = cleanData({...value});
    const key = store === 'settings' ? record.key : record.id;
    if(key === undefined || key === null) throw new Error(`El registro de ${store} no tiene identificador.`);
    if(store !== 'settings') record.id = key;
    await setDoc(doc(storeRef(store), String(key)), record);
    return key;
  }

  async function remove(store, key){
    await requireUser();
    await deleteDoc(doc(storeRef(store), String(key)));
    return true;
  }

  async function seedIfEmpty(){
    await requireUser();
    const settings = await get('settings','config');
    if(!settings){
      await put('settings',{key:'config', currency:'EUR', vat_percent:21, invoice_next:1, budget_next:1, report_next:1, client_next:1,
        streetTechnicianMode:false,
        partTypes:['Reparación','Mantenimiento','Instalación','Garantía'],
        reportStatuses:[
          {name:'Pte visitar',color:'#0d6efd'},{name:'Segunda visita',color:'#6610f2'},
          {name:'Pte revisión',color:'#6c757d'},{name:'Pte de gestion',color:'#6f42c1'},
          {name:'Presupuesto enviado',color:'#0d6efd'},{name:'Pte de piezas',color:'#fd7e14'},
          {name:'Pte de recogida',color:'#20c997'},{name:'Presupuesto Rechazado',color:'#dc3545'},
          {name:'Finalizado',color:'#198754'}
        ]});
    }
  }

  function waitForGoogleIdentity(){
    return new Promise((resolve,reject)=>{
      const started = Date.now();
      const check = ()=>{
        if(window.google?.accounts?.oauth2) return resolve();
        if(Date.now() - started > 10000) return reject(new Error('No se pudo cargar el acceso de Google Drive.'));
        setTimeout(check,100);
      };
      check();
    });
  }

  async function getDriveToken(){
    if(driveTokenPromise) return driveTokenPromise;
    driveTokenPromise = waitForGoogleIdentity().then(()=>new Promise((resolve,reject)=>{
      driveTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id:'741995913327-qo7tno84sk6pmnudv8mvtsgoo56e59ms.apps.googleusercontent.com',
        scope:'https://www.googleapis.com/auth/drive.file',
        callback:response=>{
          if(response.error) reject(new Error(response.error_description || response.error));
          else resolve(response.access_token);
          driveTokenPromise = null;
        }
      });
      driveTokenClient.requestAccessToken({prompt:''});
    }).catch(error=>{
      driveTokenPromise = null;
      throw error;
    }));
    return driveTokenPromise;
  }

  async function uploadToDrive(file){
    const token = await getDriveToken();
    const metadata = {name:file.name, mimeType:file.type || 'application/octet-stream'};
    const boundary = `genalsat_${Date.now()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`
    ]);
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
      method:'POST',
      headers:{Authorization:`Bearer ${token}`, 'Content-Type':`multipart/related; boundary=${boundary}`},
      body
    });
    if(!response.ok) throw new Error(`Google Drive rechazó la subida (${response.status}).`);
    const uploaded = await response.json();
    return {
      driveFileId:uploaded.id,
      driveUrl:`https://drive.google.com/uc?export=download&id=${encodeURIComponent(uploaded.id)}`,
      name:uploaded.name,
      type:uploaded.mimeType
    };
  }

  async function deleteFromDrive(fileId){
    if(!fileId) return;
    const token = await getDriveToken();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method:'DELETE',
      headers:{Authorization:`Bearer ${token}`}
    });
    if(!response.ok && response.status !== 404) throw new Error(`Google Drive rechazó el borrado (${response.status}).`);
  }

  window.GenalDB = {openDB,getAll,get,add,put,remove,seedIfEmpty};
  window.GenalDrive = {upload:uploadToDrive, remove:deleteFromDrive};
})(window);

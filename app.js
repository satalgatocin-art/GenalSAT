/* app.js - UI logic for MVP (stock + parts + settings basics) */
document.addEventListener('DOMContentLoaded', async ()=>{
  try{
    await GenalDB.openDB();
    await GenalDB.seedIfEmpty();
    await updateHeaderLogo();
    initNav();
    showView('stock');
  }catch(error){
    console.error('No se pudo iniciar GenalSAT.', error);
    const app = document.getElementById('app');
    if(app) app.innerHTML = `<div class="card startup-error"><h2>No se pudo iniciar GenalSAT</h2><p>${error.message || 'Error desconocido'}</p><p>Comprueba que Google está activado en Firebase Authentication y recarga la página.</p></div>`;
  }
  if('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')){
    navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('No se pudo registrar la PWA.', error));
  }
});

window._listSort = window._listSort || {parts:'asc', budgets:'asc', invoices:'asc', clients:'asc'};
window._listPages = window._listPages || {};
const LIST_PAGE_SIZE = 50;
function pagedItems(items, key){
  const pages = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(window._listPages[key] || 1)), pages);
  window._listPages[key] = page;
  return {items: items.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE), page, pages};
}
function appendPagination(wrap, key, total, render){
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if(pages < 2) return;
  const page = Math.min(Number(window._listPages[key] || 1), pages);
  const createPager = ()=>{
    const pager = document.createElement('div');
    pager.className = 'pagination';
    const pageButtons = Array.from({length: pages}, (_, index)=>{
      const pageNumber = index + 1;
      return `<button class="btn secondary${pageNumber === page ? ' active-page' : ''}" data-page-number="${pageNumber}" aria-label="Ir a la página ${pageNumber}">${pageNumber}</button>`;
    }).join('');
    pager.innerHTML = `<button class="btn secondary" data-page="prev" ${page === 1 ? 'disabled' : ''}>Anterior</button><span class="pagination-pages">${pageButtons}</span><button class="btn secondary" data-page="next" ${page === pages ? 'disabled' : ''}>Siguiente</button><span>Página ${page} de ${pages}</span>`;
    pager.querySelector('[data-page="prev"]').onclick = ()=>{ window._listPages[key] = page - 1; render(); };
    pager.querySelector('[data-page="next"]').onclick = ()=>{ window._listPages[key] = page + 1; render(); };
    pager.querySelectorAll('[data-page-number]').forEach(button=>button.onclick = ()=>{ window._listPages[key] = Number(button.dataset.pageNumber); render(); });
    return pager;
  };
  wrap.prepend(createPager());
  wrap.appendChild(createPager());
}
function setupBulkToolbarVisibility(bulk, wrap){
  if(!bulk) return;
  const actionButtons = [...bulk.querySelectorAll('[data-bulk-action]')];
  const update = ()=>{
    const hasSelection = Boolean(wrap.querySelector('.row-select:checked'));
    actionButtons.forEach(button=>{ button.hidden = !hasSelection; });
    bulk.hidden = !hasSelection;
    bulk.style.display = hasSelection ? '' : 'none';
  };
  wrap.querySelectorAll('.row-select').forEach(input=>input.addEventListener('change', update));
  bulk.querySelector('[data-select-all]')?.addEventListener('change', update);
  update();
  return update;
}
function showToast(message, type='success'){
  let toast = document.getElementById('app-toast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove('toast-success','toast-error');
  toast.classList.add(type === 'error' ? 'toast-error' : 'toast-success');
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>toast.classList.remove('show'), 3000);
}
function openMobileFilter(button, selector, title, render){
  if(window.innerWidth > 600) return;
  const filter = document.querySelector(selector);
  if(!filter || document.querySelector('.mobile-filter-modal')) return;
  const placeholder = document.createComment('mobile-filter-placeholder');
  filter.parentNode.insertBefore(placeholder, filter);
  const modal = document.createElement('div');
  modal.className = 'mobile-filter-modal';
  modal.innerHTML = `<div class="mobile-filter-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title">
    <div class="mobile-filter-header"><h2 id="mobile-filter-title">${title}</h2><button type="button" class="close-btn" data-close-mobile-filter aria-label="Cerrar filtros">×</button></div>
    <div class="mobile-filter-body"></div>
    <div class="mobile-filter-footer"><button type="button" class="btn secondary" data-close-mobile-filter>Cerrar</button><button type="button" class="btn" data-confirm-mobile-filter>Confirmar búsqueda</button></div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.mobile-filter-body').appendChild(filter);
  window._mobileFilterOpen = true;
  const close = apply=>{
    modal.remove();
    placeholder.parentNode.insertBefore(filter, placeholder.nextSibling);
    placeholder.remove();
    window._mobileFilterOpen = false;
    if(apply) render();
  };
  modal.querySelectorAll('[data-close-mobile-filter]').forEach(control=>control.addEventListener('click', ()=>close(false)));
  modal.querySelector('[data-confirm-mobile-filter]').addEventListener('click', ()=>close(true));
  filter.querySelector('input,select')?.focus();
}
function showConfirmModal(message, confirmLabel='Eliminar'){
  return new Promise(resolve=>{
    const modal = document.createElement('div');
    modal.className = 'modal show confirm-modal';
    modal.innerHTML = `<div class="modal-content confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="modal-header"><h3 id="confirm-title">Confirmar acción</h3><button type="button" class="close-btn" aria-label="Cerrar">×</button></div>
      <div class="modal-body"><p>${message}</p></div>
      <div class="modal-footer"><button type="button" class="btn danger" data-confirm="yes">${confirmLabel}</button><button type="button" class="btn secondary" data-confirm="no">Cancelar</button></div>
    </div>`;
    document.body.appendChild(modal);
    const finish = value=>{ modal.remove(); resolve(value); };
    modal.querySelector('[data-confirm="yes"]').addEventListener('click', ()=>finish(true));
    modal.querySelector('[data-confirm="no"]').addEventListener('click', ()=>finish(false));
    modal.querySelector('.close-btn').addEventListener('click', ()=>finish(false));
    modal.addEventListener('click', event=>{ if(event.target === modal) finish(false); });
  });
}
async function updateHeaderLogo(){
  const logo = document.getElementById('company-header-logo');
  if(!logo) return;
  const settings = await GenalDB.get('settings','config');
  if(settings?.logo){
    logo.src = settings.logo;
    logo.hidden = false;
  }else{
    logo.removeAttribute('src');
    logo.hidden = true;
  }
}
function toggleListSort(key){
  window._listSort[key] = window._listSort[key] === 'asc' ? 'desc' : 'asc';
  if(key === 'parts') renderPartsList();
  if(key === 'budgets') renderBudgetsList();
  if(key === 'invoices') renderInvoicesList();
}
function sortByText(items, getter, key){
  const direction = window._listSort[key] === 'desc' ? -1 : 1;
  return items.sort((a,b)=>String(getter(a)||'').localeCompare(String(getter(b)||''),'es',{numeric:true}) * direction);
}

function initNav(){
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> showView(btn.dataset.view));
  });
}

async function openRecordPreview(view, id){
  await showView(view);
  if(view === 'parts') await previewPart(id);
  if(view === 'budgets') await previewBudget(id);
  if(view === 'invoices') await previewInvoice(id);
}

async function showView(view){
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.view === view));
  const app = document.getElementById('app');
  document.getElementById('inventory-move-modal')?.remove();
  app.innerHTML = '';
  const container = document.createElement('div'); container.className='container';

  if(view === 'stock'){
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h2>Gestión de Inventario</h2>
      <div class="inventory-toolbar">
        <input id="inventory-search" placeholder="Buscar pieza por código, nombre o tipo" aria-label="Buscar pieza por código, nombre o tipo">
        <button id="open-move-modal" class="btn">Realizar movimiento</button>
      </div>

      <div class="card">
        <h3>Productos</h3>
        <div id="stock-list"></div>
      </div>

      <div class="card">
        <h3>Historial de movimientos</h3>
        <div class="form-row moves-filters">
          <input id="filter-move-date" type="date" aria-label="Filtrar movimientos por fecha">
          <input id="filter-move-code" placeholder="Código" aria-label="Filtrar movimientos por código">
          <input id="filter-move-product" placeholder="Producto" aria-label="Filtrar movimientos por producto">
          <input id="filter-move-product-type" placeholder="Tipo" aria-label="Filtrar movimientos por tipo de producto">
          <input id="filter-move-qty" type="number" min="0" step="0.01" placeholder="Unidades" aria-label="Filtrar movimientos por unidades">
          <select id="filter-move-source" aria-label="Filtrar movimientos por origen">
            <option value="">Todos los movimientos</option>
            <option value="manual">Stock manual</option>
            <option value="part">Movimientos desde un parte</option>
          </select>
          <select id="filter-move-type" aria-label="Filtrar movimientos por entrada o salida">
            <option value="">Entrada/Salida</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
        </div>
        <div id="moves-list"></div>
      </div>
    `;
    container.appendChild(card);
    app.appendChild(container);
    const moveModal = document.createElement('div');
    moveModal.id = 'inventory-move-modal';
    moveModal.className = 'modal inventory-move-modal';
    moveModal.innerHTML = `
      <div class="inventory-move-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-move-title">
        <div class="inventory-move-header">
          <h3 id="inventory-move-title">Movimiento inventario (Entrada / Salida)</h3>
          <button id="close-move-modal" class="close-btn" aria-label="Cerrar">×</button>
        </div>
        <div class="form-row">
          <input id="m-code" placeholder="Código (opcional)" style="width:140px">
          <input id="m-product-type" placeholder="Tipo" style="width:160px">
          <div style="position:relative;flex:1">
            <input id="m-product" placeholder="Producto (escribe o selecciona)">
            <div id="product-suggestions" class="suggestions" style="display:none;position:absolute;left:0;right:0;background:white;border:1px solid #ccc;max-height:180px;overflow:auto;z-index:200"></div>
          </div>
          <datalist id="products-list" style="display:none"></datalist>
          <select id="m-type"><option value="entrada">Entrada</option><option value="salida">Salida</option></select>
          <input id="m-qty" type="number" min="1" value="1" style="width:100px">
          <input id="m-price" type="number" step="0.01" min="0" placeholder="P.Unit (para entradas)" style="width:140px">
          <input id="m-reason" placeholder="Motivo / Referencia" style="flex:1">
        </div>
        <div class="inventory-move-footer">
          <button id="apply-move" class="btn">Aplicar movimiento</button>
        </div>
      </div>
    `;
    document.body.appendChild(moveModal);
    document.getElementById('open-move-modal').addEventListener('click', ()=> moveModal.classList.add('show'));
    document.getElementById('close-move-modal').addEventListener('click', ()=> moveModal.classList.remove('show'));
    moveModal.addEventListener('click', event=>{ if(event.target === moveModal) moveModal.classList.remove('show'); });
    document.getElementById('apply-move').addEventListener('click', applyMoveHandler);
    document.getElementById('inventory-search').addEventListener('input', renderStockList);
    ['filter-move-date','filter-move-code','filter-move-product','filter-move-product-type','filter-move-qty','filter-move-source','filter-move-type']
      .forEach(id=>{
        document.getElementById(id).addEventListener('input', renderMovesList);
        document.getElementById(id).addEventListener('change', renderMovesList);
      });
    await populateProductsForMoves();
    renderStockList();
    renderMovesList();
  }

  else if(view === 'parts'){
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h2>Informes de trabajo</h2>
      <button type="button" class="btn secondary mobile-filter-trigger" data-filter-target=".parts-filters">🔎 Filtros</button>
      <div class="parts-filters card">
        <h3>Buscar partes <button type="button" class="icon-btn sort-toggle" title="Ordenar A-Z / Z-A" aria-label="Cambiar orden" data-sort-key="parts">↕</button></h3>
        <div class="parts-filter-scroll">
        <div class="parts-filter-row">
          <input id="filter-part-number" placeholder="Nº parte">
          <select id="filter-part-date-mode" title="Modo de búsqueda por fecha" aria-label="Modo de búsqueda por fecha">
            <option value="single">Fecha concreta</option>
            <option value="range">Rango de fechas</option>
          </select>
          <input id="filter-part-date" type="date" title="Fecha" aria-label="Fecha">
          <span id="filter-part-date-range" class="date-range-fields" hidden>
            <input id="filter-part-date-from" type="date" title="Fecha desde" aria-label="Fecha desde">
            <input id="filter-part-date-to" type="date" title="Fecha hasta" aria-label="Fecha hasta">
          </span>
          <input id="filter-part-client" placeholder="Cliente">
          <select id="filter-part-type" title="Filtrar por tipo"><option value="">Todos los tipos</option></select>
          <input id="filter-part-brand" placeholder="Marca">
          <input id="filter-part-model" placeholder="Modelo">
          <input id="filter-part-sn" placeholder="Nº de serie">
          <select id="filter-part-status" title="Filtrar por estado" aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option value="Pte revisión">Pte revisión</option>
            <option value="Pte de gestion">Pte de gestion</option>
            <option value="Presupuesto enviado">Presupuesto enviado</option>
            <option value="Pte de piezas">Pte de piezas</option>
            <option value="Pte de recogida">Pte de recogida</option>
            <option value="Presupuesto Rechazado">Presupuesto rechazado</option>
            <option value="Finalizado">Finalizado</option>
          </select>
          <button type="button" class="btn secondary parts-more-filters-toggle" aria-expanded="false">Más filtros</button>
        </div>
        </div>
        <div class="parts-more-filters" hidden>
          <div class="parts-filter-row">
            <input id="filter-part-problem" placeholder="Problema del cliente">
            <input id="filter-part-work" placeholder="Trabajos realizados">
            <input id="filter-part-pieces" placeholder="Piezas utilizadas">
          </div>
        </div>
      </div>
      <div id="report-form" class="modal report-form-modal" hidden>
      <div class="report-form-dialog" role="dialog" aria-modal="true" aria-labelledby="report-form-title">
      <div class="report-form-header">
        <h3 id="report-form-title">Nuevo informe de trabajo</h3>
        <button id="close-report-form" type="button" class="close-btn" aria-label="Cerrar formulario">×</button>
      </div>
      <div class="form-row">
        <input id="report-client-name" list="report-client-options" placeholder="Nombre del cliente" autocomplete="name" style="flex:1">
        <datalist id="report-client-options"></datalist>
        <input id="report-client-last" placeholder="Apellidos" autocomplete="family-name" style="flex:1">
      </div>
      <div class="form-row">
        <input id="report-client-address" placeholder="Dirección" autocomplete="street-address" style="flex:1">
        <input id="report-client-phone" placeholder="Teléfono" autocomplete="tel" style="width:180px">
      </div>
      <div class="form-row">
        <select id="report-type" title="Tipo de parte" aria-label="Tipo de parte" style="flex:1"></select>
        <input id="report-device-brand" placeholder="Marca" style="flex:1">
        <input id="report-device-model" placeholder="Modelo" style="flex:1">
        <input id="report-device-sn" placeholder="Nº de serie (SN)" style="flex:1">
        <select id="report-status" title="Estado del parte" aria-label="Estado del parte" style="flex:1">
          <option value="Pte revisión">Pte revisión</option>
          <option value="Pte de gestion">Pte de gestion</option>
          <option value="Presupuesto enviado">Presupuesto enviado</option>
          <option value="Pte de piezas">Pte de piezas</option>
          <option value="Pte de recogida">Pte de recogida</option>
          <option value="Presupuesto Rechazado">Presupuesto rechazado</option>
          <option value="Finalizado">Finalizado</option>
        </select>
      </div>
      <div class="card">
        <h3>Problema detectado por el cliente</h3>
        <textarea id="report-customer-problem" rows="3" placeholder="Describe el problema indicado por el cliente" style="width:100%;resize:vertical"></textarea>
        <h3>Trabajos realizados por el técnico</h3>
        <textarea id="report-technician-work" rows="4" placeholder="Describe las comprobaciones y trabajos realizados" style="width:100%;resize:vertical"></textarea>
        <h3>Fotos y vídeos</h3>
        <input id="report-attachments" type="file" accept="image/*,video/*" multiple>
        <div id="report-attachments-list" class="attachments-list small"></div>
      </div>
      <div class="card">
        <h3>Piezas utilizadas</h3>
        <div class="form-row">
          <select id="select-product" style="flex:1"></select>
          <input id="line-desc" placeholder="O escribe una pieza manualmente" style="flex:1">
          <input id="line-qty" type="number" min="1" value="1" style="width:100px">
          <button id="add-line" type="button" class="btn">Añadir pieza</button>
        </div>
        <div id="lines-list" class="small"></div>
        <p class="small">Las piezas seleccionadas del Stock se descontarán por defecto. Puedes desmarcar esa opción individualmente en cada pieza.</p>
        <div style="margin-top:12px"><button id="create-part" class="btn">Guardar parte</button></div>
      </div>
      </div>
      </div>
      <div class="parts-list-header"><h3>Informes existentes</h3><button id="new-part" class="btn">Nuevo parte</button></div>
      <div class="bulk-toolbar" data-bulk-type="parts"><label><input type="checkbox" data-select-all> Seleccionar todos</label><button class="btn secondary" data-bulk-action="delete">Eliminar seleccionados</button><button class="btn secondary" data-bulk-action="download">Descargar seleccionados</button></div>
      <div id="parts-list"></div>
    `;
    container.appendChild(card);
    app.appendChild(container);
    await populateClientsAndProducts();
    await populateReportPartOptions();
    setupReportClientSelector();
    setupPartDateFilter();
    document.querySelector('[data-filter-target=".parts-filters"]')?.addEventListener('click', event=>openMobileFilter(event.currentTarget,'.parts-filters','Filtrar informes',renderPartsList));
    document.getElementById('new-part').addEventListener('click', ()=>{
      resetNewPartForm();
      setPartFormLocked(false);
      openReportForm();
      document.getElementById('report-client-name').focus();
    });
    document.getElementById('close-report-form').addEventListener('click', resetNewPartForm);
    document.getElementById('report-form').addEventListener('click', event=>{
      if(event.target.id === 'report-form') resetNewPartForm();
    });
    const reportAttachments = document.getElementById('report-attachments');
    reportAttachments.addEventListener('pointerdown', prepareDriveAccess);
    reportAttachments.addEventListener('change', renderPendingAttachments);
    document.getElementById('report-status').addEventListener('change', ()=>{
      setPartFormLocked(window._editingPartId ? isFinalizedPartStatus(document.getElementById('report-status').value) : false);
    });
    document.querySelectorAll('.parts-filters input').forEach(input=>{
      input.addEventListener('input', renderPartsList);
    });
    const moreFiltersToggle = document.querySelector('.parts-more-filters-toggle');
    const moreFilters = document.querySelector('.parts-more-filters');
    moreFiltersToggle?.addEventListener('click', ()=>{
      const expanded = moreFiltersToggle.getAttribute('aria-expanded') === 'true';
      moreFiltersToggle.setAttribute('aria-expanded', String(!expanded));
      moreFilters.hidden = expanded;
    });
    document.getElementById('filter-part-status').addEventListener('change', renderPartsList);
    document.getElementById('filter-part-type').addEventListener('change', renderPartsList);
    document.getElementById('add-line').addEventListener('click', event=>{
      event.preventDefault();
      event.stopPropagation();
      addLine();
    });
    document.getElementById('create-part').addEventListener('click', createPart);
    document.querySelector('.sort-toggle[data-sort-key="parts"]').addEventListener('click', ()=>toggleListSort('parts'));
    renderPartsList();
    window._currentLines = [];
  }

  else if(view === 'agenda'){
    await renderAgendaView(container);
    app.appendChild(container);
  }

  else if(view === 'budgets'){
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h2>Presupuestos</h2>
      <button type="button" class="btn secondary mobile-filter-trigger" data-filter-target=".budget-filters">🔎 Filtros</button>
      <div class="parts-filters card budget-filters">
        <h3>Buscar presupuestos <button type="button" class="icon-btn sort-toggle" title="Ordenar A-Z / Z-A" aria-label="Cambiar orden" data-sort-key="budgets">↕</button></h3>
        <div class="parts-filter-scroll">
          <div class="parts-filter-row">
            <input id="filter-budget-number" placeholder="Nº presupuesto">
            <input id="filter-budget-part" placeholder="Nº parte">
            <input id="filter-budget-client" placeholder="Cliente">
            <input id="filter-budget-date" type="date" title="Fecha" aria-label="Fecha">
          </div>
        </div>
      </div>
      <h3>Presupuestos existentes</h3>
      <div class="bulk-toolbar" data-bulk-type="budgets"><label><input type="checkbox" data-select-all> Seleccionar todos</label><button class="btn secondary" data-bulk-action="delete">Eliminar seleccionados</button><button class="btn secondary" data-bulk-action="download">Descargar seleccionados</button></div>
      <div id="budgets-list"></div>
    `;
    container.appendChild(card);
    app.appendChild(container);
    document.querySelector('[data-filter-target=".budget-filters"]')?.addEventListener('click', event=>openMobileFilter(event.currentTarget,'.budget-filters','Filtrar presupuestos',renderBudgetsList));
    document.querySelectorAll('.budget-filters input').forEach(input=>input.addEventListener('input', renderBudgetsList));
    document.querySelector('.sort-toggle[data-sort-key="budgets"]').addEventListener('click', ()=>toggleListSort('budgets'));
    renderBudgetsList();
  }

  else if(view === 'invoices'){
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h2>Facturas</h2>
      <button type="button" class="btn secondary mobile-filter-trigger" data-filter-target=".invoice-filters">🔎 Filtros</button>
      <div class="parts-filters card invoice-filters">
        <h3>Buscar facturas <button type="button" class="icon-btn sort-toggle" title="Ordenar A-Z / Z-A" aria-label="Cambiar orden" data-sort-key="invoices">↕</button></h3>
        <div class="parts-filter-scroll">
          <div class="parts-filter-row">
            <input id="filter-invoice-number" placeholder="Nº factura">
            <input id="filter-invoice-client" placeholder="Cliente">
            <select id="filter-invoice-date-mode" title="Modo de fecha"><option value="single">Fecha concreta</option><option value="range">Rango de fechas</option></select>
            <input id="filter-invoice-date" type="date" title="Fecha" aria-label="Fecha">
            <span id="filter-invoice-date-range" class="date-range-fields" hidden><input id="filter-invoice-date-from" type="date" title="Fecha desde"><input id="filter-invoice-date-to" type="date" title="Fecha hasta"></span>
          </div>
        </div>
      </div>
      <h3>Facturas existentes</h3>
      <div class="bulk-toolbar" data-bulk-type="invoices"><label><input type="checkbox" data-select-all> Seleccionar todas</label><button class="btn secondary" data-bulk-action="delete">Eliminar seleccionadas</button><button class="btn secondary" data-bulk-action="download">Descargar seleccionadas</button><button class="btn secondary" data-bulk-action="issue">Marcar emitidas</button><button class="btn secondary" data-bulk-action="paid">Marcar cobradas</button></div>
      <div id="invoices-list"></div>
    `;
    container.appendChild(card);
    app.appendChild(container);
    document.querySelector('[data-filter-target=".invoice-filters"]')?.addEventListener('click', event=>openMobileFilter(event.currentTarget,'.invoice-filters','Filtrar facturas',renderInvoicesList));
    document.querySelectorAll('.invoice-filters input,.invoice-filters select').forEach(input=>input.addEventListener('input', renderInvoicesList));
    document.getElementById('filter-invoice-date-mode').addEventListener('change', event=>{const range=event.target.value==='range'; document.getElementById('filter-invoice-date').hidden=range; document.getElementById('filter-invoice-date-range').hidden=!range; renderInvoicesList();});
    document.querySelector('.sort-toggle[data-sort-key="invoices"]').addEventListener('click', ()=>toggleListSort('invoices'));
    renderInvoicesList();
  }

  else if(view === 'clients'){
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <h2>Clientes</h2>
      <div class="parts-filters card client-filters">
        <div class="client-filters-header">
          <h3>Buscar clientes <button type="button" class="icon-btn sort-toggle" title="Ordenar A-Z / Z-A" aria-label="Cambiar orden" data-sort-key="clients">↕</button></h3>
        </div>
        <div class="parts-filter-scroll">
          <div class="parts-filter-row">
            <input id="client-search-name" placeholder="Nombre o apellidos" aria-label="Buscar por nombre">
            <input id="client-search-dni" placeholder="DNI / NIF" aria-label="Buscar por DNI o NIF">
            <input id="client-search-phone" placeholder="Teléfono" aria-label="Buscar por teléfono">
            <input id="client-search-locality" placeholder="Localidad" aria-label="Buscar por localidad">
            <button id="open-client-form" class="btn client-add-button">Añadir Cliente</button>
          </div>
        </div>
      </div>
      <button type="button" class="btn secondary mobile-filter-trigger" data-filter-target=".client-filters">🔎 Filtros</button>
      <div class="card">
        <h3>Clientes existentes</h3>
        <div id="clients-list"></div>
      </div>
    `;
    container.appendChild(card);
    app.appendChild(container);
    window._editingClientId = null;
    document.getElementById('open-client-form').addEventListener('click', ()=>openClientFormModal());
    document.querySelector('[data-filter-target=".client-filters"]')?.addEventListener('click', event=>openMobileFilter(event.currentTarget,'.client-filters','Filtrar clientes',renderClientsList));
    document.querySelectorAll('.client-filters input').forEach(input=>input.addEventListener('input', renderClientsList));
    document.querySelector('.sort-toggle[data-sort-key="clients"]').addEventListener('click', ()=>toggleListSort('clients'));
    renderClientsList();
  }

  else if(view === 'settings'){
    const card = document.createElement('div'); card.className='card';
    const settings = await GenalDB.get('settings','config');
    const company = settings.company || {};
    card.innerHTML = `
      <h2>Ajustes</h2>
      <details class="settings-section"><summary>Cambio de moneda e IVA</summary>
        <div class="form-row">
          <label class="small">Moneda</label>
          <input id="s-currency" value="${settings.currency}">
          <label class="small">IVA %</label>
          <input id="s-vat" type="number" value="${settings.vat_percent}">
        </div>
      </details>
      <details class="settings-section"><summary>Datos de la empresa</summary>
      <div class="settings-section-body">
        <div class="form-row">
        <input id="company-name" placeholder="Nombre empresa" value="${company.name||''}" style="flex:1">
        <input id="company-tax" placeholder="CIF/NIF" value="${company.tax||''}">
        </div>
        <div class="form-row">
        <input id="company-address" placeholder="Dirección" value="${company.address||''}" style="flex:1">
        <input id="company-postal" placeholder="Código postal" value="${company.postal||''}" style="width:120px">
        </div>
        <div class="form-row">
        <input id="company-city" placeholder="Población" value="${company.city||''}">
        <input id="company-province" placeholder="Provincia" value="${company.province||''}">
        </div>
        <div class="form-row">
        <input id="company-phone" placeholder="Teléfono" value="${company.phone||''}">
        <input id="company-email" placeholder="Email" value="${company.email||''}">
        </div>
      </div>
      </details>
      <details class="settings-section"><summary>Logo</summary><div class="settings-section-body">
        <div class="form-row">
        <label class="small">Logo (PNG/JPG)</label>
        <input id="s-logo" type="file" accept="image/*">
        <img id="logo-preview" src="${settings.logo||''}" alt="" style="height:48px;object-fit:contain">
        </div>
      </div></details>
      <details class="settings-section"><summary>Tipos de parte</summary>
        <div class="settings-section-body"><div id="part-types-settings"></div>
        <div class="form-row"><input id="new-part-type" placeholder="Nuevo tipo"><button id="add-part-type" class="btn">Añadir tipo</button></div></div>
      </details>
      <details class="settings-section"><summary>Estados de informes de trabajo</summary>
        <div class="settings-section-body"><div id="report-statuses-settings"></div>
        <div class="form-row"><input id="new-report-status" placeholder="Nuevo estado"><select id="new-report-status-color" title="Color"></select><button id="add-report-status" class="btn">Añadir estado</button></div></div>
      </details>
      <details class="settings-section"><summary>Modo Técnico de calle</summary>
        <div class="settings-section-body">
          <label class="settings-toggle"><input id="s-street-technician-mode" type="checkbox" ${settings.streetTechnicianMode ? 'checked' : ''}> Activar Modo Técnico de calle</label>
          <p class="small">Al activarlo, Informes de Trabajo mostrará únicamente los informes con una cita para el día actual e incluirá la hora de la cita.</p>
        </div>
      </details>
      <div style="margin-top:12px">
        <button id="save-settings" class="btn">Guardar</button>
        <button id="export-data" class="btn secondary">Exportar copia JSON</button>
        <button id="import-data" class="btn secondary" type="button">Importar copia JSON</button>
        <input id="import-file" type="file" accept="application/json" hidden>
      </div>
    `;
    container.appendChild(card);
    app.appendChild(container);
    // logo handling: when user selects a file, read as dataURL and preview
    document.getElementById('s-logo').addEventListener('change', async (e)=>{
      const f = e.target.files[0]; if(!f) return; const reader = new FileReader();
      reader.onload = function(evt){
        const dataUrl = evt.target.result;
        document.getElementById('logo-preview').src = dataUrl;
        // store temporarily until save
        window._pendingLogoDataUrl = dataUrl;
      };
      reader.readAsDataURL(f);
    });

    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('import-data').addEventListener('click', ()=>document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importData);
    const settingsSections = [...card.querySelectorAll('.settings-section')];
    settingsSections.forEach(section=>section.addEventListener('toggle', ()=>{
      if(!section.open) return;
      settingsSections.forEach(other=>{
        if(other !== section) other.open = false;
      });
    }));
    renderPartSettings(settings);
  }
}

async function getPartSettings(){
  const cfg = await GenalDB.get('settings','config') || {};
  return {
    types: Array.isArray(cfg.partTypes) ? cfg.partTypes : ['Reparación','Mantenimiento','Instalación','Garantía'],
    statuses: Array.isArray(cfg.reportStatuses) ? cfg.reportStatuses : [{name:'Pte revisión',color:'#6c757d'},{name:'Finalizado',color:'#198754'}]
  };
}
async function renderPartSettings(settings){
  const types = Array.isArray(settings.partTypes) ? settings.partTypes : [];
  const statuses = Array.isArray(settings.reportStatuses) ? settings.reportStatuses : [];
  const colors = [
    ['#6c757d','Gris'],['#0d6efd','Azul'],['#198754','Verde'],['#dc3545','Rojo'],
    ['#fd7e14','Naranja'],['#6f42c1','Morado'],['#20c997','Turquesa'],['#ffc107','Amarillo']
  ];
  const colorOptions = selected => colors.map(([value,label])=>`<option value="${value}" aria-label="${label}" title="${label}" style="background-color:${value};color:${value};" ${value === selected ? 'selected' : ''}>●</option>`).join('');
  const typeWrap = document.getElementById('part-types-settings');
  const statusWrap = document.getElementById('report-statuses-settings');
  if(typeWrap) typeWrap.innerHTML = types.map((type,i)=>`<div class="settings-crud-row"><input value="${type}" data-part-type="${i}"><button class="icon-btn danger" data-delete-part-type="${i}">🗑</button></div>`).join('') || '<p class="small">Sin tipos configurados.</p>';
  if(statusWrap) statusWrap.innerHTML = statuses.map((status,i)=>`<div class="settings-crud-row status-settings-row">
    <span class="status-order-number">${i + 1}</span>
    <input value="${status.name}" data-status-name="${i}">
    <select data-status-color="${i}" title="Color">${colorOptions(status.color || '#6c757d')}</select>
    <button type="button" class="icon-btn" data-move-status="${i}" data-direction="up" title="Subir estado" aria-label="Subir estado" ${i === 0 ? 'disabled' : ''}>↑</button>
    <button type="button" class="icon-btn" data-move-status="${i}" data-direction="down" title="Bajar estado" aria-label="Bajar estado" ${i === statuses.length - 1 ? 'disabled' : ''}>↓</button>
    <button class="icon-btn danger" data-delete-status="${i}" title="Eliminar estado" aria-label="Eliminar estado">🗑</button>
  </div>`).join('') || '<p class="small">Sin estados configurados.</p>';
  const newColor = document.getElementById('new-report-status-color');
  if(newColor) newColor.innerHTML = colorOptions('#6c757d');
  statusWrap?.querySelectorAll('[data-status-color]').forEach(select=>{
    select.classList.add('color-picker-select');
    select.style.backgroundColor = select.value;
    select.style.color = 'transparent';
  });
  if(newColor){
    newColor.classList.add('color-picker-select');
    newColor.style.backgroundColor = newColor.value;
    newColor.style.color = 'transparent';
    newColor.onchange = ()=>{ newColor.style.backgroundColor = newColor.value; };
  }
  typeWrap?.querySelectorAll('[data-part-type]').forEach(input=>input.addEventListener('change', async ()=>{
    const cfg=await GenalDB.get('settings','config'); cfg.partTypes=cfg.partTypes||[]; cfg.partTypes[Number(input.dataset.partType)]=input.value.trim(); cfg.partTypes=cfg.partTypes.filter(Boolean); await GenalDB.put('settings',cfg); renderPartSettings(cfg);
  }));
  statusWrap?.querySelectorAll('[data-status-name],[data-status-color]').forEach(input=>input.addEventListener('change', async ()=>{
    const cfg=await GenalDB.get('settings','config'); cfg.reportStatuses=cfg.reportStatuses||[]; const i=Number(input.dataset.statusName ?? input.dataset.statusColor); cfg.reportStatuses[i] = {...cfg.reportStatuses[i],name:statusWrap.querySelector(`[data-status-name="${i}"]`).value.trim(),color:statusWrap.querySelector(`[data-status-color="${i}"]`).value}; cfg.reportStatuses=cfg.reportStatuses.filter(s=>s.name); await GenalDB.put('settings',cfg); renderPartSettings(cfg);
  }));
  statusWrap?.querySelectorAll('[data-move-status]').forEach(button=>button.addEventListener('click', async ()=>{
    const cfg = await GenalDB.get('settings','config');
    const statuses = Array.isArray(cfg.reportStatuses) ? cfg.reportStatuses : [];
    const index = Number(button.dataset.moveStatus);
    const targetIndex = button.dataset.direction === 'up' ? index - 1 : index + 1;
    if(index < 0 || targetIndex < 0 || index >= statuses.length || targetIndex >= statuses.length) return;
    [statuses[index], statuses[targetIndex]] = [statuses[targetIndex], statuses[index]];
    cfg.reportStatuses = statuses;
    await GenalDB.put('settings', cfg);
    renderPartSettings(cfg);
  }));
  typeWrap?.querySelectorAll('[data-delete-part-type]').forEach(btn=>btn.addEventListener('click', async ()=>{const cfg=await GenalDB.get('settings','config'); cfg.partTypes.splice(Number(btn.dataset.deletePartType),1); await GenalDB.put('settings',cfg); renderPartSettings(cfg);}));
  statusWrap?.querySelectorAll('[data-delete-status]').forEach(btn=>btn.addEventListener('click', async ()=>{const cfg=await GenalDB.get('settings','config'); cfg.reportStatuses.splice(Number(btn.dataset.deleteStatus),1); await GenalDB.put('settings',cfg); renderPartSettings(cfg);}));
  document.getElementById('add-part-type')?.addEventListener('click', async ()=>{const input=document.getElementById('new-part-type'); const value=input.value.trim(); if(!value)return; const cfg=await GenalDB.get('settings','config'); cfg.partTypes=cfg.partTypes||[]; if(!cfg.partTypes.includes(value))cfg.partTypes.push(value); await GenalDB.put('settings',cfg); input.value=''; renderPartSettings(cfg);});
  document.getElementById('add-report-status')?.addEventListener('click', async ()=>{const input=document.getElementById('new-report-status'); const value=input.value.trim(); if(!value)return; const cfg=await GenalDB.get('settings','config'); cfg.reportStatuses=cfg.reportStatuses||[]; if(!cfg.reportStatuses.some(s=>s.name===value))cfg.reportStatuses.push({name:value,color:document.getElementById('new-report-status-color').value}); await GenalDB.put('settings',cfg); input.value=''; renderPartSettings(cfg);});
}

async function populateReportPartOptions(){
  const {types,statuses}=await getPartSettings();
  const type = document.getElementById('report-type');
  const filter = document.getElementById('filter-part-type');
  if(type) type.innerHTML = '<option value="">Tipo de parte</option>'+types.map(v=>`<option>${v}</option>`).join('');
  if(filter) filter.innerHTML = '<option value="">Todos los tipos</option>'+types.map(v=>`<option>${v}</option>`).join('');
  const status = document.getElementById('report-status');
  const statusFilter = document.getElementById('filter-part-status');
  if(status) status.innerHTML = statuses.map(v=>`<option value="${v.name}">${v.name}</option>`).join('');
  if(statusFilter) statusFilter.innerHTML = '<option value="">Todos los estados</option>'+statuses.map(v=>`<option value="${v.name}">${v.name}</option>`).join('');
  return statuses;
}

/* Stock handlers */
async function openProductEditModal(productId){
  const product = await GenalDB.get('products', productId);
  if(!product){
    showToast('Producto no encontrado.', 'error');
    return;
  }
  document.getElementById('product-edit-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'product-edit-modal';
  modal.className = 'modal product-edit-modal show';
  modal.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="product-edit-title">
      <div class="modal-header">
        <h3 id="product-edit-title">Modificar producto</h3>
        <button type="button" class="close-btn" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label style="flex:1">Código<input id="edit-product-code" value="${product.code || ''}" style="width:100%"></label>
          <label style="flex:1">Nombre<input id="edit-product-name" value="${product.name || ''}" style="width:100%"></label>
          <label style="flex:1">Tipo<input id="edit-product-type" value="${product.type || ''}" style="width:100%"></label>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn secondary" data-product-edit-cancel>Cancelar</button>
        <button type="button" class="btn" data-product-edit-save>Guardar cambios</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = ()=>modal.remove();
  modal.querySelector('.close-btn').addEventListener('click', close);
  modal.querySelector('[data-product-edit-cancel]').addEventListener('click', close);
  modal.addEventListener('click', event=>{ if(event.target === modal) close(); });
  modal.querySelector('[data-product-edit-save]').addEventListener('click', async ()=>{
    const code = modal.querySelector('#edit-product-code').value.trim();
    const name = modal.querySelector('#edit-product-name').value.trim();
    const type = modal.querySelector('#edit-product-type').value.trim();
    if(!name){
      showToast('El nombre del producto es obligatorio.', 'error');
      return;
    }
    const products = await GenalDB.getAll('products');
    const duplicate = products.find(item=>Number(item.id) !== Number(product.id)
      && code && String(item.code || '').trim() === code);
    if(duplicate){
      showToast('Ya existe otro producto con ese código.', 'error');
      return;
    }
    if(code) product.code = code;
    else delete product.code;
    product.name = name;
    product.type = type;
    await GenalDB.put('products', product);
    close();
    await populateProductsForMoves();
    renderStockList();
    renderMovesList();
    showToast('Producto actualizado.');
  });
  modal.querySelector('#edit-product-code').focus();
}

async function renderStockList(){
  const list = await GenalDB.getAll('products');
  const wrap = document.getElementById('stock-list');
  if(!wrap) return;
  wrap.innerHTML='';
  const query = (document.getElementById('inventory-search')?.value || '').trim().toLowerCase();
  const filtered = list.filter(p=>{
    if(!query) return true;
    return String(p.code || '').toLowerCase().includes(query)
      || String(p.name || '').toLowerCase().includes(query)
      || String(p.type || '').toLowerCase().includes(query);
  });
  const table = document.createElement('table'); table.className='table';
  table.innerHTML = `<thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Cantidad</th><th>Precio unit. (promedio)</th><th>Precio total</th><th>Acciones</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  const pageData = pagedItems(filtered, 'products');
  pageData.items.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.code||''}</td><td>${p.name||''}</td><td>${p.type||'—'}</td><td>${p.qty||0}</td><td>${Number(p.price||0).toFixed(2)} €</td><td>${(Number(p.price||0) * Number(p.qty||0)).toFixed(2)} €</td><td><button class="icon-btn edit-action" title="Editar" aria-label="Editar" data-id="${p.id}" data-action="edit">✎</button> <button class="icon-btn danger" title="Eliminar" aria-label="Eliminar" data-id="${p.id}" data-action="del">🗑</button></td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table);
  wrap.querySelectorAll('[data-action="edit"]').forEach(btn=> btn.addEventListener('click', event=>{
    event.stopPropagation();
    openProductEditModal(Number(btn.dataset.id));
  }));
  if(filtered.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" class="small">No se encontraron piezas.</td>';
    tbody.appendChild(tr);
  }
  wrap.querySelectorAll('[data-action="del"]').forEach(btn=> btn.addEventListener('click', async ()=>{
    const id = Number(btn.dataset.id);
    const product = await GenalDB.get('products', id);
    if(Number(product?.qty || 0) > 0){
      showToast('No se puede eliminar un producto que todavía tiene unidades en inventario.', 'error');
      return;
    }
    if(confirm('Eliminar producto?')){ await GenalDB.remove('products', id); renderStockList(); renderMovesList(); }
  }));
  appendPagination(wrap, 'products', filtered.length, renderStockList);
}

async function addProductHandler(){
  const code = document.getElementById('p-code').value.trim();
  const name = document.getElementById('p-name').value.trim();
  const qty = Number(document.getElementById('p-qty').value) || 0;
  const price = Number(document.getElementById('p-price').value) || 0.0;
  if(!name){ showToast('Nombre requerido', 'error'); return; }
  try{
    const id = await GenalDB.add('products',{...(code ? {code} : {}),name,qty,price});
    // if initial quantity > 0, create an initial entrada move
    if(qty > 0){
      const move = { productId: id, productCode: code, productName: name, productType: '', source: 'manual', type: 'entrada', qty: qty, unitPrice: price, reason: 'Inicial - creación producto', date: new Date().toISOString() };
      await GenalDB.add('moves', move);
    }
    document.getElementById('p-code').value='';document.getElementById('p-name').value='';document.getElementById('p-qty').value='';document.getElementById('p-price').value='';
    await populateProductsForMoves();
    renderStockList();
    renderMovesList();
  }catch(err){ showToast('Error al añadir producto. ¿Código duplicado?', 'error'); }
}

async function populateProductsForMoves(){
  const products = await GenalDB.getAll('products');
  const datalist = document.getElementById('products-list'); if(!datalist) return; datalist.innerHTML='';
  // maps for quick lookup and array for suggestions
  window._productsByCode = {};
  window._productsByName = {};
  window._productsList = products.slice();
  products.forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.name || '';
    opt.dataset.id = p.id;
    datalist.appendChild(opt);
    if(p.code) window._productsByCode[p.code] = p;
    if(p.name) window._productsByName[p.name] = p;
  });

  const prodInput = document.getElementById('m-product');
  const codeInput = document.getElementById('m-code');
  const suggestions = document.getElementById('product-suggestions');
  if(!prodInput) return;
  // remove previous listeners if any
  prodInput.oninput = null; prodInput.onblur = null; prodInput.onfocus = null;
  prodInput.oninput = function(){
    const v = prodInput.value.trim().toLowerCase();
    // auto-fill exact name
    const exact = window._productsByName[prodInput.value.trim()];
    if(exact){ codeInput.value = exact.code || ''; }
    // show suggestions
    if(!v){ suggestions.style.display = 'none'; suggestions.innerHTML = ''; return; }
    const matches = window._productsList.filter(p=> (p.name||'').toLowerCase().includes(v) || (p.code||'').toLowerCase().includes(v)).slice(0,10);
    if(matches.length === 0){ suggestions.style.display = 'none'; suggestions.innerHTML = ''; return; }
    suggestions.innerHTML = '';
    for(const m of matches){
      const item = document.createElement('div'); item.className='suggestion-item';
      item.style.padding = '6px'; item.style.cursor = 'pointer'; item.style.borderBottom = '1px solid #f0f0f0';
      item.textContent = `${m.code||''} — ${m.name || ''} (qty ${m.qty||0})`;
      item.onclick = function(){ prodInput.value = m.name || ''; codeInput.value = m.code || ''; suggestions.style.display='none'; suggestions.innerHTML=''; };
      suggestions.appendChild(item);
    }
    suggestions.style.display = 'block';
  };
  // hide suggestions on blur (delay to allow click)
  prodInput.onblur = function(){ setTimeout(()=>{ suggestions.style.display='none'; }, 150); };
  prodInput.onfocus = function(){ prodInput.oninput(); };
}

async function applyMoveHandler(){
  const code = document.getElementById('m-code')?.value.trim() || '';
  const prodName = document.getElementById('m-product')?.value.trim() || '';
  const prodType = document.getElementById('m-product-type')?.value.trim() || '';
  const type = document.getElementById('m-type').value; // 'entrada' or 'salida'
  const qty = Number(document.getElementById('m-qty').value) || 0;
  const unitPrice = Number(document.getElementById('m-price').value) || 0.0;
  const reason = document.getElementById('m-reason').value.trim() || '';
  if(!prodName && !code){ showToast('Proporciona producto o código', 'error'); return; }
  if(qty <= 0){ showToast('Cantidad debe ser mayor que 0', 'error'); return; }
  // find product by code or name
  let prod = null;
  if(code){
    const allByCode = window._productsByCode || {};
    prod = allByCode[code];
  }
  if(!prod && prodName){
    const allByName = window._productsByName || {};
    prod = allByName[prodName];
  }
  // if product not found, create it
  if(!prod){
    const newProd = { ...(code ? {code} : {}), name: prodName || ('Producto ' + Date.now()), type: prodType, qty: 0, price: 0 };
    const newId = await GenalDB.add('products', newProd);
    newProd.id = newId;
    prod = newProd;
  }
  const prodId = prod.id;
  // reload current product from DB to ensure latest
  const prodCurrent = await GenalDB.get('products', prodId);
  if(prodType && !prodCurrent.type) prodCurrent.type = prodType;
  if(type === 'salida' && (prodCurrent.qty || 0) < qty){ if(!confirm('Stock insuficiente: continuar y permitir stock negativo?')) return; }
  if(type === 'entrada'){
    const oldQty = Number(prodCurrent.qty || 0);
    const oldPrice = Number(prodCurrent.price || 0);
    const newQty = oldQty + qty;
    const newPrice = newQty > 0 ? ((oldQty * oldPrice) + (qty * unitPrice)) / newQty : unitPrice;
    prodCurrent.qty = newQty;
    prodCurrent.price = Number(newPrice.toFixed(2));
    await GenalDB.put('products', prodCurrent);
    const move = { productId: prodId, productCode: prodCurrent.code || '', productName: prodCurrent.name || '', productType: prodCurrent.type || '', source: 'manual', type: 'entrada', qty, unitPrice, reason, date: new Date().toISOString() };
    await GenalDB.add('moves', move);
  } else {
    prodCurrent.qty = (prodCurrent.qty || 0) - qty;
    await GenalDB.put('products', prodCurrent);
    const move = { productId: prodId, productCode: prodCurrent.code || '', productName: prodCurrent.name || '', productType: prodCurrent.type || '', source: 'manual', type: 'salida', qty, unitPrice: unitPrice || prodCurrent.price || 0, reason, date: new Date().toISOString() };
    await GenalDB.add('moves', move);
  }
  // reset form
  document.getElementById('m-qty').value = 1; document.getElementById('m-price').value = ''; document.getElementById('m-reason').value = ''; document.getElementById('m-code').value = ''; document.getElementById('m-product').value = ''; document.getElementById('m-product-type').value = '';
  await populateProductsForMoves();
  renderStockList();
  renderMovesList();
  document.getElementById('inventory-move-modal')?.classList.remove('show');
}

async function renderMovesList(){
  const moves = await GenalDB.getAll('moves');
  const products = await GenalDB.getAll('products');
  const productsById = new Map(products.map(product=>[Number(product.id), product]));
  const wrap = document.getElementById('moves-list'); if(!wrap) return; wrap.innerHTML='';
  const renderToken = (window._movesRenderToken || 0) + 1;
  window._movesRenderToken = renderToken;
  const dateFilter = document.getElementById('filter-move-date')?.value || '';
  const codeFilter = (document.getElementById('filter-move-code')?.value || '').trim().toLocaleLowerCase();
  const productFilter = (document.getElementById('filter-move-product')?.value || '').trim().toLocaleLowerCase();
  const productTypeFilter = (document.getElementById('filter-move-product-type')?.value || '').trim().toLocaleLowerCase();
  const qtyFilter = document.getElementById('filter-move-qty')?.value || '';
  const sourceFilter = document.getElementById('filter-move-source')?.value || '';
  const typeFilter = document.getElementById('filter-move-type')?.value || '';
  const filtered = moves.filter(m=>{
    const codeText = String(m.productCode || '').toLocaleLowerCase();
    const productText = String(m.productName || '').toLocaleLowerCase();
    const productTypeText = String(m.productType || productsById.get(Number(m.productId))?.type || '').toLocaleLowerCase();
    const date = new Date(m.date).toISOString().slice(0,10);
    return (!dateFilter || date === dateFilter)
      && (!codeFilter || codeText.includes(codeFilter))
      && (!productFilter || productText.includes(productFilter))
      && (!productTypeFilter || productTypeText.includes(productTypeFilter))
      && (!qtyFilter || Number(m.qty) === Number(qtyFilter))
      && (!sourceFilter
        || (sourceFilter === 'manual' && (m.source || 'manual') === 'manual')
        || (sourceFilter === 'part' && m.source === 'part'))
      && (!typeFilter || m.type === typeFilter);
  });
  if(filtered.length === 0){
    if(renderToken === window._movesRenderToken) wrap.innerHTML = `<p class="small">${moves.length ? 'No hay movimientos que coincidan con los filtros.' : 'No hay movimientos registrados.'}</p>`;
    return;
  }
  const table = document.createElement('table'); table.className='table';
  table.innerHTML = `<thead><tr><th>Fecha</th><th>Código</th><th>Producto</th><th>Tipo</th><th>Entrada/Salida</th><th>Cantidad</th><th>P.Unit</th><th>Total</th><th>Origen</th><th>Motivo</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  const sortedMoves = filtered.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const pageData = pagedItems(sortedMoves, 'moves');
  for(const m of pageData.items){
    const prod = await GenalDB.get('products', m.productId);
    const tr = document.createElement('tr');
    const productCode = prod?.code || m.productCode || '';
    const productText = prod?.name || m.productName || '';
    const productType = prod?.type || m.productType || '—';
    const sourceText = m.source === 'part' ? 'Parte' : 'Stock manual';
    const reasonHtml = m.partId
      ? `${m.partAction === 'devuelto' ? 'Devuelto a stock' : 'Stock descontado'} · <button class="link-button move-part-link" data-part-id="${m.partId}">${m.partNumber || 'Parte'}</button>`
      : (m.reason || '—');
    tr.innerHTML = `<td>${new Date(m.date).toLocaleString()}</td><td>${productCode}</td><td>${productText}</td><td>${productType}</td><td>${m.type}</td><td>${m.qty}</td><td>${Number(m.unitPrice||0).toFixed(2)} €</td><td>${Number((m.unitPrice||0)*m.qty).toFixed(2)} €</td><td>${sourceText}</td><td>${reasonHtml}</td>`;
    tr.querySelector('.move-part-link')?.addEventListener('click', async event=>{
      event.stopPropagation();
      const partId = Number(event.currentTarget.dataset.partId);
      await openRecordPreview('parts', partId);
    });
    tbody.appendChild(tr);
  }
  if(renderToken !== window._movesRenderToken || !document.getElementById('moves-list')) return;
  table.appendChild(tbody); wrap.appendChild(table);
  appendPagination(wrap, 'moves', sortedMoves.length, renderMovesList);
}

async function addPartStockMove(part, line, type, qty, reason){
  if(!line?.productId || !qty) return;
  const product = await GenalDB.get('products', line.productId);
  await GenalDB.add('moves', {
    productId: line.productId,
    productCode: product?.code || line.productCode || '',
    productName: product?.name || line.description || '',
    productType: product?.type || '',
    source: 'part',
    partId: part.id,
    partNumber: part.number,
    partAction: type === 'salida' ? 'descontado' : 'devuelto',
    type,
    qty: Number(qty),
    unitPrice: Number(product?.price || line.unitPrice || 0),
    reason,
    date: new Date().toISOString()
  });
}

async function returnPartStockOnDeletion(part){
  if(part.stockDeducted === false) return;
  const lines = (part.pieces || part.lines || []).filter(line=>line.productId && line.deductStock !== false);
  for(const line of lines){
    const product = await GenalDB.get('products', line.productId);
    if(product){
      product.qty = Number(product.qty || 0) + Number(line.qty || 0);
      await GenalDB.put('products', product);
    }
    await addPartStockMove(
      part,
      line,
      'entrada',
      Number(line.qty || 0),
      `Parte ${part.number} - devuelto a stock por eliminación de informe`
    );
  }
}

/* Parts handlers */
async function populateClientsAndProducts(){
  const clients = await GenalDB.getAll('clients');
  const reportOptions = document.getElementById('report-client-options');
  if(reportOptions){
    reportOptions.innerHTML='';
    clients.forEach(c=>{
      const option = document.createElement('option');
      option.value = getClientDisplayName(c);
      reportOptions.appendChild(option);
    });
  }
  const products = await GenalDB.getAll('products');
  const selProd = document.getElementById('select-product');
  if(selProd){
    selProd.innerHTML='';
    products.forEach(p=>{ const o = document.createElement('option'); o.value=p.id; o.textContent=`${p.code||''} - ${p.name} (qty ${p.qty})`; selProd.appendChild(o); });
  }

}

function setupReportClientSelector(){
  const nameInput = document.getElementById('report-client-name');
  if(!nameInput) return;
  window._selectedReportClientId = null;
  nameInput.addEventListener('input', async ()=>{
    const typedName = nameInput.value.trim().toLocaleLowerCase();
    const clients = await GenalDB.getAll('clients');
    const client = clients.find(c=>getClientDisplayName(c).toLocaleLowerCase() === typedName);
    if(client){
      window._selectedReportClientId = client.id;
      fillReportClientFields(client);
    }else{
      window._selectedReportClientId = null;
    }
  });
}

function fillReportClientFields(client){
  document.getElementById('report-client-name').value = client.firstName || client.name || '';
  document.getElementById('report-client-last').value = client.lastName || '';
  document.getElementById('report-client-address').value = client.address || '';
  document.getElementById('report-client-phone').value = client.phone || client.contact || '';
}

async function resolveReportClient(){
  const firstName = document.getElementById('report-client-name').value.trim();
  const lastName = document.getElementById('report-client-last').value.trim();
  const address = document.getElementById('report-client-address').value.trim();
  const phone = document.getElementById('report-client-phone').value.trim();
  if(!firstName && !lastName){
    showToast('Indica el nombre o los apellidos del cliente.', 'error');
    return null;
  }

  const existing = window._selectedReportClientId
    ? await GenalDB.get('clients', window._selectedReportClientId)
    : null;
  if(existing){
    existing.firstName = firstName;
    existing.lastName = lastName;
    existing.address = address;
    existing.phone = phone;
    existing.updatedAt = new Date().toISOString();
    await GenalDB.put('clients', existing);
    return existing.id;
  }

  const clients = await GenalDB.getAll('clients');
  const typedDisplayName = getClientDisplayName({firstName, lastName}).toLocaleLowerCase();
  const exact = clients.find(c=>getClientDisplayName(c).toLocaleLowerCase() === typedDisplayName);
  if(exact){
    window._selectedReportClientId = exact.id;
    return resolveReportClient();
  }

  const settings = await GenalDB.get('settings','config') || {};
  const existingNumbers = clients
    .map(client => Number(String(client.clientNumber || '').match(/(\d+)$/)?.[1] || 0))
    .filter(number => number > 0);
  const nextClientNumber = Math.max(Number(settings.client_next) || 1, ...(existingNumbers.length ? [Math.max(...existingNumbers) + 1] : []));
  const client = {
    clientNumber: `C-${String(nextClientNumber).padStart(6,'0')}`,
    firstName,
    lastName,
    address,
    locality: '',
    province: '',
    postalCode: '',
    dni: '',
    phone,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const id = await GenalDB.add('clients', client);
  settings.client_next = nextClientNumber + 1;
  await GenalDB.put('settings', settings);
  window._selectedReportClientId = id;
  return id;
}

function getClientDisplayName(client){
  if(!client) return '—';
  const fullName = [client.firstName, client.lastName].filter(Boolean).join(' ').trim();
  return fullName || client.name || 'Cliente sin nombre';
}

async function saveClientHandler(){
  const firstName = document.getElementById('c-first').value.trim();
  const lastName = document.getElementById('c-last').value.trim();
  const address = document.getElementById('c-address').value.trim();
  const locality = document.getElementById('c-locality').value.trim();
  const province = document.getElementById('c-province').value.trim();
  const postalCode = document.getElementById('c-postal').value.trim();
  const dni = document.getElementById('c-dni').value.trim();
  const phone = document.getElementById('c-phone').value.trim();

  if(!firstName && !lastName){
    showToast('Indica al menos el nombre o los apellidos del cliente.', 'error');
    return;
  }

  const clients = await GenalDB.getAll('clients');
  const normalize = value => String(value || '').trim().toLocaleLowerCase();
  const duplicate = clients.find(existing=>Number(existing.id) !== Number(window._editingClientId)
    && [existing.firstName || existing.name, existing.lastName, existing.address, existing.locality, existing.province, existing.postalCode, existing.dni, existing.phone || existing.contact]
      .map(normalize).join('|') === [firstName, lastName, address, locality, province, postalCode, dni, phone].map(normalize).join('|'));
  if(duplicate){
    showToast('Ya existe un cliente con todos esos datos.', 'error');
    return;
  }
  const currentSettings = await GenalDB.get('settings','config') || {};
  const existingNumbers = clients
    .map(client => Number(String(client.clientNumber || '').match(/(\d+)$/)?.[1] || 0))
    .filter(number => number > 0);
  const nextClientNumber = Math.max(Number(currentSettings.client_next) || 1, ...(existingNumbers.length ? [Math.max(...existingNumbers) + 1] : []));
  const clientNumber = window._editingClientId
    ? (await GenalDB.get('clients', window._editingClientId))?.clientNumber
    : `C-${String(nextClientNumber).padStart(6,'0')}`;
  const client = { clientNumber, firstName, lastName, address, locality, province, postalCode, dni, phone, updatedAt: new Date().toISOString() };
  if(window._editingClientId !== null){
    client.id = window._editingClientId;
    const previous = await GenalDB.get('clients', window._editingClientId);
    client.createdAt = previous?.createdAt || new Date().toISOString();
    await GenalDB.put('clients', client);
  }else{
    client.createdAt = new Date().toISOString();
    await GenalDB.add('clients', client);
    currentSettings.client_next = nextClientNumber + 1;
    await GenalDB.put('settings', currentSettings);
  }

  resetClientForm();
  document.getElementById('client-form-modal')?.remove();
  await renderClientsList();
}

async function openClientDetailsModal(client){
  document.getElementById('client-details-modal')?.remove();
  const [parts, budgets, invoices] = await Promise.all([
    GenalDB.getAll('parts'),
    GenalDB.getAll('budgets'),
    GenalDB.getAll('invoices')
  ]);
  const clientParts = parts.filter(part=>Number(part.clientId) === Number(client.id))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const clientBudgets = budgets.filter(budget=>Number(budget.clientId) === Number(client.id))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const clientInvoices = invoices.filter(invoice=>Number(invoice.clientId) === Number(client.id))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const modal = document.createElement('div');
  modal.id = 'client-details-modal';
  modal.className = 'modal client-details-modal show';
  modal.innerHTML = `
    <div class="client-details-dialog" role="dialog" aria-modal="true" aria-labelledby="client-details-title">
      <div class="report-form-header">
        <h3 id="client-details-title">${getClientDisplayName(client)}</h3>
        <button type="button" class="close-btn" aria-label="Cerrar">×</button>
      </div>
      <div class="client-details-data">
        <p><strong>Nombre:</strong> ${getClientDisplayName(client)}</p>
        <p><strong>Dirección:</strong> ${client.address || '—'}</p>
        <p><strong>Localidad:</strong> ${client.locality || '—'}</p>
        <p><strong>Provincia:</strong> ${client.province || '—'}</p>
        <p><strong>Código postal:</strong> ${client.postalCode || '—'}</p>
        <p><strong>DNI / NIF:</strong> ${client.dni || '—'}</p>
        <p><strong>Teléfono:</strong> ${client.phone || '—'}</p>
        <p><strong>Fecha de alta:</strong> ${client.createdAt ? new Date(client.createdAt).toLocaleString() : '—'}</p>
      </div>
      <div class="client-related">
        <div><h4>Partes (${clientParts.length})</h4>
          <ul>${clientParts.length ? clientParts.map(part=>`<li><button type="button" class="client-part-link" data-part-id="${part.id}">${part.number || 'Parte'}</button> · ${part.status || 'Pte revisión'} · ${new Date(part.createdAt).toLocaleDateString()}</li>`).join('') : '<li class="small">Sin partes</li>'}</ul>
        </div>
        <div><h4>Presupuestos (${clientBudgets.length})</h4>
          <ul>${clientBudgets.length ? clientBudgets.map(budget=>`<li><button type="button" class="client-budget-link" data-budget-id="${budget.id}">${budget.number}</button> · ${fmtCurrency(budget.total)} · ${new Date(budget.createdAt).toLocaleDateString()}</li>`).join('') : '<li class="small">Sin presupuestos</li>'}</ul>
        </div>
        <div><h4>Facturas (${clientInvoices.length})</h4>
          <ul>${clientInvoices.length ? clientInvoices.map(invoice=>`<li><button type="button" class="client-invoice-link" data-invoice-id="${invoice.id}">${invoice.number}</button> · ${fmtCurrency(invoice.total)} · ${invoice.issued ? 'Emitida' : 'Pendiente'} · ${new Date(invoice.createdAt).toLocaleDateString()}</li>`).join('') : '<li class="small">Sin facturas</li>'}</ul>
        </div>
      </div>
      <div class="modal-footer"><button type="button" class="btn" data-client-detail-action="edit">Editar</button></div>
    </div>`;
  document.body.appendChild(modal);
  const close = ()=>modal.remove();
  modal.querySelector('.close-btn').addEventListener('click', close);
  modal.querySelector('[data-client-detail-action="edit"]').addEventListener('click', ()=>{
    close();
    openClientFormModal(client);
  });
  modal.addEventListener('click', event=>{ if(event.target === modal) close(); });
  modal.querySelectorAll('.client-part-link').forEach(button=>button.addEventListener('click', async ()=>{
    const partId = Number(button.dataset.partId);
    close();
    await showView('parts');
    await previewPart(partId);
  }));
  modal.querySelectorAll('.client-budget-link').forEach(button=>button.addEventListener('click', async ()=>{
    const budgetId = Number(button.dataset.budgetId);
    close();
    await showView('budgets');
    await previewBudget(budgetId);
  }));
  modal.querySelectorAll('.client-invoice-link').forEach(button=>button.addEventListener('click', async ()=>{
    const invoiceId = Number(button.dataset.invoiceId);
    close();
    await showView('invoices');
    await previewInvoice(invoiceId);
  }));
}

async function renderClientsList(){
  if(window._mobileFilterOpen) return;
  const wrap = document.getElementById('clients-list');
  if(!wrap) return;
  const clients = await GenalDB.getAll('clients');
  wrap.innerHTML = '';

  const nameQuery = (document.getElementById('client-search-name')?.value || '').trim().toLowerCase();
  const dniQuery = (document.getElementById('client-search-dni')?.value || '').trim().toLowerCase();
  const phoneQuery = (document.getElementById('client-search-phone')?.value || '').trim().toLowerCase();
  const localityQuery = (document.getElementById('client-search-locality')?.value || '').trim().toLowerCase();
  const filteredClients = clients.filter(client=>{
    return (!nameQuery || getClientDisplayName(client).toLowerCase().includes(nameQuery))
      && (!dniQuery || String(client.dni || '').toLowerCase().includes(dniQuery))
      && (!phoneQuery || String(client.phone || '').toLowerCase().includes(phoneQuery))
      && (!localityQuery || String(client.locality || '').toLowerCase().includes(localityQuery));
  });
  sortByText(filteredClients, client=>getClientDisplayName(client), 'clients');

  if(filteredClients.length === 0){
    wrap.innerHTML = '<p class="small">No hay clientes registrados.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = '<thead><tr><th>Nº cliente</th><th>Nombre</th><th>Dirección</th><th>Localidad</th><th>Provincia</th><th>Código postal</th><th>DNI / NIF</th><th>Teléfono</th><th>Fecha de alta</th><th>Acciones</th></tr></thead>';
  const tbody = document.createElement('tbody');

  const pageData = pagedItems(filteredClients, 'clients');
  pageData.items.forEach(client=>{
    const row = document.createElement('tr');
    const values = [
      client.clientNumber || '—',
      getClientDisplayName(client),
      client.address || '',
      client.locality || '',
      client.province || '',
      client.postalCode || '',
      client.dni || '',
      client.phone || '',
      client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '—'
    ];
    values.forEach(value=>{
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });

    const actions = document.createElement('td');
    const editButton = document.createElement('button');
    editButton.className = 'icon-btn edit-action';
    editButton.innerHTML = '✎';
    editButton.title = 'Editar';
    editButton.setAttribute('aria-label','Editar');
    editButton.addEventListener('click', ()=>editClient(client));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'icon-btn danger';
    deleteButton.innerHTML = '🗑';
    deleteButton.title = 'Eliminar';
    deleteButton.setAttribute('aria-label','Eliminar');
    deleteButton.style.marginLeft = '8px';
    deleteButton.addEventListener('click', ()=>deleteClient(client));
    editButton.addEventListener('click', event=>event.stopPropagation());
    deleteButton.addEventListener('click', event=>event.stopPropagation());
    actions.append(editButton, deleteButton);
    row.appendChild(actions);
    tbody.appendChild(row);
    row.addEventListener('click', ()=>openClientDetailsModal(client));
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  appendPagination(wrap, 'clients', filteredClients.length, renderClientsList);
}

function editClient(client){
  openClientFormModal(client);
}

function openClientFormModal(client=null){
  document.getElementById('client-form-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'client-form-modal';
  modal.className = 'modal client-form-modal show';
  modal.innerHTML = `
    <div class="client-form-dialog" role="dialog" aria-modal="true" aria-labelledby="client-form-title">
      <div class="report-form-header">
        <h3 id="client-form-title">${client ? 'Editar cliente' : 'Añadir cliente'}</h3>
        <button type="button" class="close-btn" id="close-client-form" aria-label="Cerrar formulario">×</button>
      </div>
      <div class="form-row">
        <input id="c-first" placeholder="Nombre" autocomplete="given-name" style="flex:1">
        <input id="c-last" placeholder="Apellidos" autocomplete="family-name" style="flex:1">
      </div>
      <div class="form-row">
        <input id="c-address" placeholder="Dirección" autocomplete="street-address" style="flex:1">
        <input id="c-locality" placeholder="Localidad" autocomplete="address-level2" style="flex:1">
      </div>
      <div class="form-row">
        <input id="c-province" placeholder="Provincia" autocomplete="address-level1" style="flex:1">
        <input id="c-postal" placeholder="Código postal" autocomplete="postal-code" inputmode="numeric" style="width:150px">
      </div>
      <div class="form-row">
        <input id="c-dni" placeholder="DNI / NIF" style="width:180px">
        <input id="c-phone" placeholder="Teléfono" autocomplete="tel" style="width:180px">
      </div>
      <div class="modal-footer">
        <button id="save-client" class="btn">${client ? 'Guardar cambios' : 'Añadir cliente'}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  window._editingClientId = client ? client.id : null;
  if(client){
    document.getElementById('c-first').value = client.firstName || client.name || '';
    document.getElementById('c-last').value = client.lastName || '';
    document.getElementById('c-address').value = client.address || '';
    document.getElementById('c-locality').value = client.locality || '';
    document.getElementById('c-province').value = client.province || '';
    document.getElementById('c-postal').value = client.postalCode || '';
    document.getElementById('c-dni').value = client.dni || '';
    document.getElementById('c-phone').value = client.phone || client.contact || '';
  }
  const close = ()=>{ modal.remove(); window._editingClientId = null; };
  document.getElementById('save-client').addEventListener('click', saveClientHandler);
  document.getElementById('close-client-form').addEventListener('click', close);
  modal.addEventListener('click', event=>{ if(event.target === modal) close(); });
  document.getElementById('c-first').focus();
}

function editClientLegacy(client){
  document.getElementById('c-first').value = client.firstName || client.name || '';
  document.getElementById('c-last').value = client.lastName || '';
  document.getElementById('c-address').value = client.address || '';
  document.getElementById('c-locality').value = client.locality || '';
  document.getElementById('c-province').value = client.province || '';
  document.getElementById('c-postal').value = client.postalCode || '';
  document.getElementById('c-dni').value = client.dni || '';
  document.getElementById('c-phone').value = client.phone || client.contact || '';
  window._editingClientId = client.id;
  document.getElementById('client-form-title').textContent = 'Editar cliente';
  document.getElementById('save-client').textContent = 'Guardar cambios';
  document.getElementById('c-first').focus();
}

async function deleteClient(client){
  if(!confirm(`¿Eliminar a ${getClientDisplayName(client)}?`)) return;
  await GenalDB.remove('clients', client.id);
  await renderClientsList();
  await populateClientsAndProducts();
}

function resetClientForm(){
  const fields = ['c-first','c-last','c-address','c-locality','c-province','c-postal','c-dni','c-phone'];
  fields.forEach(id=>{ const field = document.getElementById(id); if(field) field.value = ''; });
  window._editingClientId = null;
  const title = document.getElementById('client-form-title');
  const saveButton = document.getElementById('save-client');
  if(title) title.textContent = 'Añadir cliente';
  if(saveButton) saveButton.textContent = 'Añadir cliente';
}

function addLine(){
  const prodId = Number(document.getElementById('select-product').value);
  const manualDesc = document.getElementById('line-desc').value.trim();
  const qty = Number(document.getElementById('line-qty').value) || 1;
  if(!prodId && !manualDesc){ showToast('Selecciona un producto o escribe una pieza', 'error'); return; }
  if(qty <= 0){ showToast('La cantidad debe ser mayor que 0', 'error'); return; }
  window._currentLines = window._currentLines || [];
  const line = manualDesc ? {description:manualDesc,qty} : {productId:prodId,qty};
  if(prodId) line.deductStock = true;
  window._currentLines.push(line);
  document.getElementById('line-desc').value = '';
  document.getElementById('line-qty').value = 1;
  renderLines();
}

async function renderLines(){
  const wrap = document.getElementById('lines-list'); if(!wrap) return; wrap.innerHTML='';
  const table = document.createElement('table');
  table.className = 'table part-lines-table';
  table.innerHTML = '<thead><tr><th>Pieza</th><th>Cantidad</th><th>Stock</th><th>Acciones</th></tr></thead><tbody></tbody>';
  wrap.appendChild(table);
  const tbody = table.querySelector('tbody');
  for(const [i,line] of window._currentLines.entries()){
    const p = line.productId ? await GenalDB.get('products', line.productId) : null;
    const description = line.description || `${p?.code || ''} - ${p?.name || 'Pieza eliminada'}`;
    const row = document.createElement('tr');
    const descriptionCell = document.createElement('td');
    descriptionCell.textContent = description;
    row.appendChild(descriptionCell);
    const quantityCell = document.createElement('td');
    quantityCell.textContent = line.qty;
    row.appendChild(quantityCell);
    const stockCell = document.createElement('td');
    row.appendChild(stockCell);
    if(line.productId){
      const stockLabel = document.createElement('label');
      stockLabel.className = 'small stock-deduction-option';
      const stockCheckbox = document.createElement('input');
      stockCheckbox.type = 'checkbox';
      stockCheckbox.checked = line.deductStock !== false;
      stockCheckbox.disabled = Boolean(window._partFormLocked);
      stockCheckbox.title = window._editingPartId
        ? 'Indica si esta pieza debe descontarse del stock'
        : 'Descontar esta pieza del stock';
      stockCheckbox.addEventListener('change', ()=>{
        line.deductStock = stockCheckbox.checked;
      });
      stockLabel.appendChild(stockCheckbox);
      stockLabel.appendChild(document.createTextNode(' Descontar stock'));
      stockCell.appendChild(stockLabel);
    }
    const actionCell = document.createElement('td');
    const btn = document.createElement('button'); btn.type='button'; btn.textContent='Quitar'; btn.className = 'btn secondary';
    btn.disabled = Boolean(window._partFormLocked);
    btn.addEventListener('click', ()=>{ window._currentLines.splice(i,1); renderLines(); });
    actionCell.appendChild(btn);
    row.appendChild(actionCell);
    tbody.appendChild(row);
  }
  if(!window._currentLines.length) table.hidden = true;
}

async function createPart(){
  const clientId = await resolveReportClient();
  if(!clientId) return;
  const pieces = (window._currentLines || []).slice();
  const editingPart = window._editingPartId ? await GenalDB.get('parts', window._editingPartId) : null;
  const stockLines = pieces.filter(line=>line.productId && line.deductStock !== false);
  const stockDelta = new Map();
  const addStockDelta = (line, amount)=>{
    if(!line.productId) return;
    stockDelta.set(line.productId, (stockDelta.get(line.productId) || 0) + amount);
  };
  if(editingPart){
    for(const line of (editingPart.pieces || editingPart.lines || [])){
      if(line.productId && editingPart.stockDeducted !== false && line.deductStock !== false){
        addStockDelta(line, Number(line.qty || 0));
      }
    }
    for(const line of stockLines){
      addStockDelta(line, -Number(line.qty || 0));
    }
  }
  if(!editingPart){
    for(const line of stockLines){
      const p = await GenalDB.get('products', line.productId);
      if(!p || Number(p.qty || 0) < line.qty){
        showToast(`Stock insuficiente para ${p?.name || 'la pieza seleccionada'}`, 'error');
        return;
      }
    }
  }else{
    for(const [productId, delta] of stockDelta){
      if(delta >= 0) continue;
      const product = await GenalDB.get('products', productId);
      if(!product || Number(product.qty || 0) < Math.abs(delta)){
        showToast(`Stock insuficiente para ${product?.name || 'la pieza seleccionada'}`, 'error');
        return;
      }
    }
  }
  const cfg = await getConfig();
  const reportNumber = editingPart?.number || `IT-${String(cfg.report_next || 1).padStart(6,'0')}`;
  const part = {
    ...(editingPart || {}),
    number: reportNumber,
    clientId,
    device: {
      brand: document.getElementById('report-device-brand').value.trim(),
      model: document.getElementById('report-device-model').value.trim(),
      serialNumber: document.getElementById('report-device-sn').value.trim()
    },
    customerProblem: document.getElementById('report-customer-problem').value.trim(),
    technicianWork: document.getElementById('report-technician-work').value.trim(),
    attachments: (window._pendingPartAttachments || []).slice(),
    pieces,
    lines: pieces,
    stockDeducted: stockLines.length > 0,
    createdAt: editingPart?.createdAt || new Date().toISOString(),
    type: document.getElementById('report-type').value,
    status: document.getElementById('report-status').value
  };
  if(!editingPart){
    for(const line of stockLines){
      const p = await GenalDB.get('products', line.productId);
      p.qty -= line.qty;
      await GenalDB.put('products', p);
    }
  }else{
    for(const [productId, delta] of stockDelta){
      if(!delta) continue;
      const product = await GenalDB.get('products', productId);
      if(product){
        product.qty = Number(product.qty || 0) + delta;
        await GenalDB.put('products', product);
      }
    }
  }
  if(editingPart){
    await GenalDB.put('parts', part);
  }else{
    part.id = await GenalDB.add('parts', part);
    cfg.report_next = (cfg.report_next || 1) + 1;
    await GenalDB.put('settings', cfg);
  }
  await syncAppointmentsForPart(part);
  if(!editingPart){
    for(const line of stockLines){
      await addPartStockMove(part, line, 'salida', Number(line.qty || 0), `Parte ${part.number} - stock descontado`);
    }
  }else{
    for(const [productId, delta] of stockDelta){
      if(!delta) continue;
      const line = pieces.find(item=>Number(item.productId) === Number(productId))
        || (editingPart.pieces || editingPart.lines || []).find(item=>Number(item.productId) === Number(productId));
      await addPartStockMove(
        part,
        {...line, productId},
        delta < 0 ? 'salida' : 'entrada',
        Math.abs(delta),
        `Parte ${part.number} - ajuste de stock por modificación`
      );
    }
  }
  resetNewPartForm();
  await populateClientsAndProducts();
  renderPartsList();
  renderStockList();
  showToast((editingPart ? 'Informe actualizado: ' : 'Informe creado: ') + reportNumber);
}

function resetNewPartForm(){
  window._editingPartId = null;
  window._editingPartNumber = '';
  window._partFormLocked = false;
  window._currentLines = [];
  ['report-client-name','report-client-last','report-client-address','report-client-phone','report-device-brand','report-device-model','report-device-sn','report-customer-problem','report-technician-work'].forEach(id=>{
    const field = document.getElementById(id);
    if(field) field.value='';
  });
  const status = document.getElementById('report-status');
  if(status) status.value = 'Pte revisión';
  const type = document.getElementById('report-type');
  if(type) type.value = '';
  window._selectedReportClientId = null;
  const lines = document.getElementById('lines-list');
  if(lines) lines.innerHTML='';
  const lineDescription = document.getElementById('line-desc');
  if(lineDescription) lineDescription.value = '';
  window._pendingPartAttachments = [];
  const attachmentInput = document.getElementById('report-attachments');
  if(attachmentInput) attachmentInput.value = '';
  const attachmentList = document.getElementById('report-attachments-list');
  if(attachmentList) attachmentList.innerHTML = '';
  const form = document.getElementById('report-form');
  if(form){
    form.hidden = true;
    form.classList.remove('show');
  }
  const title = document.getElementById('report-form-title');
  if(title) title.textContent = 'Nuevo informe de trabajo';
  const saveButton = document.getElementById('create-part');
  if(saveButton) saveButton.textContent = 'Guardar parte';
}

function openReportForm(){
  const form = document.getElementById('report-form');
  if(!form) return;
  form.hidden = false;
  form.classList.add('show');
}

async function editPart(partId){
  const part = await GenalDB.get('parts', partId);
  if(!part){ showToast('Informe no encontrado', 'error'); return; }
  const client = await GenalDB.get('clients', part.clientId);
  window._editingPartId = part.id;
  window._editingPartNumber = part.number || '';
  window._currentLines = (part.pieces || part.lines || []).map(line=>({...line}));
  window._pendingPartAttachments = (part.attachments || []).map(attachment=>({...attachment}));
  window._selectedReportClientId = client?.id || null;
  fillReportClientFields(client || {});
  const device = part.device || {};
  document.getElementById('report-device-brand').value = device.brand || '';
  document.getElementById('report-device-model').value = device.model || '';
  document.getElementById('report-device-sn').value = device.serialNumber || '';
  await populateReportPartOptions();
  document.getElementById('report-type').value = part.type || '';
  document.getElementById('report-status').value = part.status === 'Terminado'
    ? 'Finalizado'
    : (part.status || 'Pte revisión');
  document.getElementById('report-customer-problem').value = part.customerProblem || part.desc || '';
  document.getElementById('report-technician-work').value = part.technicianWork || '';
  const title = document.getElementById('report-form-title');
  if(title) title.textContent = `Modificar informe ${part.number || ''}`;
  const saveButton = document.getElementById('create-part');
  if(saveButton) saveButton.textContent = 'Guardar cambios';
  openReportForm();
  setPartFormLocked(isFinalizedPartStatus(part.status));
  renderAttachmentList(window._pendingPartAttachments, document.getElementById('report-attachments-list'), !isFinalizedPartStatus(part.status));
  document.getElementById('report-client-name').focus();
  document.getElementById('report-form').scrollIntoView({behavior:'smooth', block:'start'});
}

function isFinalizedPartStatus(status){
  const normalized = String(status || '').trim().toLocaleLowerCase();
  return normalized === 'finalizado' || normalized === 'terminado' || normalized === 'presupuesto rechazado';
}

function setPartFormLocked(locked){
  window._partFormLocked = locked;
  const editableIds = [
    'report-client-name','report-client-last','report-client-address','report-client-phone',
    'report-device-brand','report-device-model','report-device-sn',
    'report-type',
    'report-customer-problem','report-technician-work','report-attachments',
    'select-product','line-desc','line-qty','add-line'
  ];
  editableIds.forEach(id=>{
    const field = document.getElementById(id);
    if(field) field.disabled = locked;
  });
  const status = document.getElementById('report-status');
  if(status) status.disabled = false;
  const title = document.getElementById('report-form-title');
  if(title) title.textContent = locked
    ? `Informe finalizado: ${window._editingPartNumber || ''}`
    : (window._editingPartId ? `Modificar informe ${window._editingPartNumber || ''}` : 'Nuevo informe de trabajo');
  renderLines();
  renderAttachmentList(
    window._pendingPartAttachments || [],
    document.getElementById('report-attachments-list'),
    !locked
  );
}

async function renderPendingAttachments(event){
  const files = Array.from(event.target.files || []);
  window._pendingPartAttachments = window._pendingPartAttachments || [];
  for(const file of files){
    try{
      window._pendingPartAttachments.push(await GenalDrive.upload(file));
    }catch(error){
      console.error('No se pudo subir el adjunto a Google Drive.', error);
      showToast(`No se pudo subir ${file.name}: ${error.message || 'error de Google Drive'}`, 'error');
    }
  }
  event.target.value = '';
  renderAttachmentList(window._pendingPartAttachments, document.getElementById('report-attachments-list'), true);
}

function prepareDriveAccess(){
  GenalDrive.prepareAccess().catch(error=>{
    console.error('No se pudo autorizar Google Drive.', error);
    showToast(`No se pudo autorizar Google Drive: ${error.message || 'error de autenticación'}`, 'error');
  });
}

function readFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = ()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function resolveAttachmentUrl(attachment){
  if(attachment.dataUrl) return attachment.dataUrl;
  if(attachment._previewUrl) return attachment._previewUrl;
  if(!attachment.driveFileId) return attachment.driveUrl || '';
  try{
    const blob = await GenalDrive.download(attachment.driveFileId);
    attachment._previewUrl = URL.createObjectURL(blob);
    return attachment._previewUrl;
  }catch(error){
    console.error('No se pudo cargar el archivo desde Google Drive.', error);
    return '';
  }
}

async function downloadAttachment(attachment){
  if(!attachment.driveFileId){
    const link = document.createElement('a');
    link.href = attachment.dataUrl || attachment.driveUrl || '';
    link.download = attachment.name || 'archivo-adjunto';
    link.click();
    return;
  }
  const blob = await GenalDrive.download(attachment.driveFileId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name || 'archivo-adjunto';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function openAttachmentViewer(attachments, initialIndex){
  if(!attachments?.length) return;
  let modal = document.getElementById('attachment-viewer');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'attachment-viewer';
    modal.className = 'modal attachment-viewer';
    modal.innerHTML = `
      <div class="attachment-viewer-content" role="dialog" aria-modal="true" aria-label="Visor de archivos">
        <button type="button" class="attachment-viewer-close" aria-label="Cerrar visor">×</button>
        <button type="button" class="attachment-viewer-nav prev" aria-label="Archivo anterior">‹</button>
        <div class="attachment-viewer-stage"></div>
        <button type="button" class="attachment-viewer-nav next" aria-label="Archivo siguiente">›</button>
        <div class="attachment-viewer-caption"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.attachment-viewer-close').addEventListener('click', closeAttachmentViewer);
    modal.addEventListener('click', event=>{
      if(event.target === modal) closeAttachmentViewer();
    });
  }
  modal._attachments = attachments;
  modal._index = initialIndex;
  modal.querySelector('.prev').onclick = ()=>moveAttachmentViewer(-1);
  modal.querySelector('.next').onclick = ()=>moveAttachmentViewer(1);
  renderAttachmentViewer();
  modal.classList.add('show');
}

async function renderAttachmentViewer(){
  const modal = document.getElementById('attachment-viewer');
  if(!modal) return;
  const attachments = modal._attachments || [];
  if(!attachments.length) return closeAttachmentViewer();
  modal._index = (modal._index + attachments.length) % attachments.length;
  const attachment = attachments[modal._index];
  const stage = modal.querySelector('.attachment-viewer-stage');
  stage.innerHTML = '';
  const media = attachment.type?.startsWith('video/')
    ? document.createElement('video')
    : document.createElement('img');
  const mediaUrl = await resolveAttachmentUrl(attachment);
  if(!mediaUrl) return;
  media.src = mediaUrl;
  media.alt = attachment.name || 'Archivo adjunto';
  if(media.tagName === 'VIDEO'){
    media.controls = true;
    media.autoplay = true;
  }
  stage.appendChild(media);
  modal.querySelector('.attachment-viewer-caption').textContent =
    `${attachment.name || 'Archivo adjunto'} · ${modal._index + 1} de ${attachments.length}`;
  modal.querySelector('.prev').hidden = attachments.length < 2;
  modal.querySelector('.next').hidden = attachments.length < 2;
}

function moveAttachmentViewer(direction){
  const modal = document.getElementById('attachment-viewer');
  if(!modal) return;
  modal._index += direction;
  renderAttachmentViewer();
}

function closeAttachmentViewer(){
  const modal = document.getElementById('attachment-viewer');
  if(!modal) return;
  const video = modal.querySelector('video');
  if(video) video.pause();
  modal.classList.remove('show');
}

document.addEventListener('keydown', event=>{
  const modal = document.getElementById('attachment-viewer');
  if(!modal?.classList.contains('show')) return;
  if(event.key === 'Escape') closeAttachmentViewer();
  if(event.key === 'ArrowLeft') moveAttachmentViewer(-1);
  if(event.key === 'ArrowRight') moveAttachmentViewer(1);
});

function renderAttachmentList(attachments, container, editable=false, onRemove=null){
  if(!container) return;
  container.innerHTML = '';
  if(!attachments.length){
    container.textContent = 'No hay archivos adjuntos.';
    return;
  }
  attachments.forEach((attachment, index)=>{
    const item = document.createElement('div');
    item.className = 'attachment-item';
    const preview = attachment.type.startsWith('video/')
      ? document.createElement('video')
      : document.createElement('img');
    resolveAttachmentUrl(attachment).then(url=>{
      if(url) preview.src = url;
    });
    preview.className = 'attachment-preview';
    if(preview.tagName === 'VIDEO'){
      preview.controls = true;
      preview.preload = 'metadata';
    }
    preview.title = 'Abrir visor';
    preview.addEventListener('click', event=>{
      event.stopPropagation();
      openAttachmentViewer(attachments, index);
    });
    item.appendChild(preview);
    const name = document.createElement('span');
    name.textContent = attachment.name;
    item.appendChild(name);
    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.className = 'btn attachment-view-btn';
    viewButton.textContent = 'Ver';
    viewButton.title = 'Abrir visor';
    viewButton.addEventListener('click', event=>{
      event.stopPropagation();
      openAttachmentViewer(attachments, index);
    });
    item.appendChild(viewButton);
    const download = document.createElement('a');
    download.className = 'attachment-download';
    download.textContent = 'Descargar';
    download.title = `Descargar ${attachment.name || 'archivo adjunto'}`;
    download.setAttribute('aria-label', `Descargar ${attachment.name || 'archivo adjunto'}`);
    download.addEventListener('click', async event=>{
      event.preventDefault();
      event.stopPropagation();
      try{
        await downloadAttachment(attachment);
      }catch(error){
        console.error('No se pudo descargar el archivo de Google Drive.', error);
        showToast('No se pudo descargar el archivo.', 'error');
      }
    });
    item.appendChild(download);
    if(editable || onRemove){
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn secondary';
      remove.textContent = editable ? 'Quitar' : 'Eliminar';
      remove.title = editable ? 'Quitar antes de guardar' : 'Eliminar archivo guardado';
      remove.addEventListener('click', async event=>{
        event.stopPropagation();
        if(editable){
          const removedAttachment = window._pendingPartAttachments[index];
          if(removedAttachment?.driveFileId){
            try{
              await GenalDrive.remove(removedAttachment.driveFileId);
            }catch(error){
              console.error('No se pudo eliminar el archivo de Google Drive.', error);
              showToast('No se pudo quitar el archivo de Google Drive.', 'error');
              return;
            }
          }
          window._pendingPartAttachments.splice(index, 1);
          renderAttachmentList(window._pendingPartAttachments, container, true);
        }else if(onRemove){
          await onRemove(index);
        }
      });
      item.appendChild(remove);
    }
    container.appendChild(item);
  });
}

function setupPartDateFilter(){
  const mode = document.getElementById('filter-part-date-mode');
  const singleDate = document.getElementById('filter-part-date');
  const rangeFields = document.getElementById('filter-part-date-range');
  if(!mode || !singleDate || !rangeFields) return;
  const updateDateMode = ()=>{
    const isRange = mode.value === 'range';
    singleDate.hidden = isRange;
    rangeFields.hidden = !isRange;
    if(isRange) singleDate.value = '';
    else {
      document.getElementById('filter-part-date-from').value = '';
      document.getElementById('filter-part-date-to').value = '';
    }
    renderPartsList();
  };
  mode.addEventListener('change', updateDateMode);
  rangeFields.addEventListener('input', renderPartsList);
  singleDate.addEventListener('input', renderPartsList);
  singleDate.hidden = false;
  rangeFields.hidden = true;
}

function formatAppointmentTime(value){
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
}
function localDateKey(value){
  const date = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function findAppointmentConflicts(appointments, dateTime, excludedId=null){
  const targetDate = new Date(dateTime);
  if(Number.isNaN(targetDate.getTime())) return [];
  const targetDay = localDateKey(targetDate);
  return appointments
    .filter(item=>Number(item.id) !== Number(excludedId) && localDateKey(item.dateTime) === targetDay)
    .filter(item=>Math.abs(new Date(item.dateTime).getTime() - targetDate.getTime()) < 60 * 60 * 1000)
    .sort((a,b)=>Math.abs(new Date(a.dateTime).getTime() - targetDate.getTime()) - Math.abs(new Date(b.dateTime).getTime() - targetDate.getTime()));
}

async function confirmAppointmentConflict(appointments, dateTime, excludedId=null){
  const conflicts = findAppointmentConflicts(appointments, dateTime, excludedId);
  if(!conflicts.length) return true;
  const details = conflicts.map(item=>`${agendaDateTimeLabel(item.dateTime)}${item.status === 'Finalizada' ? ' (Finalizada)' : ''}`).join(', ');
  return showConfirmModal(
    `Ya hay ${conflicts.length === 1 ? 'una cita' : 'citas'} el mismo día a menos de una hora: ${details}. ¿Quieres guardar la cita de todas formas?`,
    'Guardar igualmente'
  );
}

function renderPartsTable(wrap, pageData, total, technicianMode=false){
  const table = document.createElement('table');
  table.className = `table parts-data-table${technicianMode ? ' technician-mode' : ''}`;
  const appointmentHeader = '<th class="part-appointment-header">Hora cita</th>';
  table.innerHTML = `<thead><tr>
    <th><input type="checkbox" data-table-select-all aria-label="Seleccionar todos los partes"></th>
    <th>Número</th><th>Cliente</th><th>Fecha</th>${appointmentHeader}<th>Tipo</th><th>Marca</th><th>Modelo</th><th>Nº serie</th><th>Estado</th><th>Acciones</th>
  </tr></thead><tbody></tbody>`;
  wrap.appendChild(table);
  const tbody = table.querySelector('tbody');
  pageData.items.forEach(({part:p, client})=>{
    const device = p.device || {};
    const displayStatus = p.status === 'Terminado' ? 'Finalizado' : (p.status || 'Pte revisión');
    const appointmentTime = (p.appointments || []).map(item=>formatAppointmentTime(item.dateTime)).join(', ') || '—';
    const row = document.createElement('tr');
    const mobileDetails = `
      <div class="part-mobile-details">
        <dl>
          <div><dt>Fecha</dt><dd>${new Date(p.createdAt).toLocaleDateString()}</dd></div>
          <div><dt>Tipo</dt><dd>${p.type || '—'}</dd></div>
          <div><dt>Marca</dt><dd>${device.brand || '—'}</dd></div>
          <div><dt>Modelo</dt><dd>${device.model || '—'}</dd></div>
          <div><dt>Nº serie</dt><dd>${device.serialNumber || '—'}</dd></div>
        </dl>
        <div class="part-actions">
          <button class="icon-btn" title="Vista previa" aria-label="Vista previa" data-action="preview-report">👁</button>
          <button class="icon-btn pdf-action" title="Exportar PDF" aria-label="Exportar PDF" data-action="pdf-report"><span>PDF</span></button>
          <button class="icon-btn" title="Crear presupuesto" aria-label="Crear presupuesto" data-action="part-budget">💶</button>
          <button class="icon-btn invoice-action" title="Crear factura" aria-label="Crear factura" data-action="part-invoice"><span>$</span></button>
          <button class="icon-btn edit-action" title="Modificar parte" aria-label="Modificar parte" data-action="edit-part">✎</button>
          <button class="icon-btn danger" title="Eliminar" aria-label="Eliminar" data-action="del">🗑</button>
        </div>
      </div>`;
    row.innerHTML = `<td><input type="checkbox" class="row-select" data-row-id="${p.id}" aria-label="Seleccionar ${p.number || 'parte'}"></td>
      <td class="part-number-cell">${p.number || 'Informe antiguo'}</td>
      <td class="part-client-cell">${getClientDisplayName(client)}</td><td class="part-date-cell">${new Date(p.createdAt).toLocaleDateString()}</td><td class="part-appointment-time">${appointmentTime}</td>
      <td>${p.type || '—'}</td><td>${device.brand || '—'}</td><td>${device.model || '—'}</td>
      <td>${device.serialNumber || '—'}</td><td class="part-status-cell" title="Pulsar para cambiar el estado"><span class="part-status">${displayStatus}</span></td>
      <td><div class="part-actions">
        <button class="icon-btn" title="Vista previa" aria-label="Vista previa" data-action="preview-report">👁</button>
        <button class="icon-btn pdf-action" title="Exportar PDF" aria-label="Exportar PDF" data-action="pdf-report"><span>PDF</span></button>
        <button class="icon-btn" title="Crear presupuesto" aria-label="Crear presupuesto" data-action="part-budget">💶</button>
        <button class="icon-btn invoice-action" title="Crear factura" aria-label="Crear factura" data-action="part-invoice"><span>$</span></button>
        <button class="icon-btn edit-action" title="Modificar parte" aria-label="Modificar parte" data-action="edit-part">✎</button>
        <button class="icon-btn danger" title="Eliminar" aria-label="Eliminar" data-action="del">🗑</button>
      </div></td><td class="part-mobile-details-cell" colspan="10">${mobileDetails}</td>`;
    tbody.appendChild(row);
    getPartSettings().then(({statuses})=>{
      const found = statuses.find(s=>s.name === displayStatus);
      if(found){ row.querySelector('.part-status').style.backgroundColor = found.color; row.querySelector('.part-status').style.color = '#fff'; }
    });
    const statusCell = row.querySelector('.part-status-cell');
    statusCell.addEventListener('click', async event=>{
      event.stopPropagation();
      if(statusCell.querySelector('.inline-status-menu')) return;
      const {statuses} = await getPartSettings();
      const menu = document.createElement('div');
      menu.className = 'inline-status-menu';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', `Cambiar estado de ${p.number || 'parte'}`);
      statuses.forEach(status=>{
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'inline-status-option';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(status.name === displayStatus));
        option.innerHTML = `<span class="inline-status-color" style="background-color:${status.color || '#6c757d'}"></span><span>${status.name}</span>`;
        option.addEventListener('click', async optionEvent=>{
          optionEvent.stopPropagation();
          const latestPart = await GenalDB.get('parts', p.id);
          if(!latestPart){
            closeMenu();
            showToast('No se ha encontrado el parte.', 'error');
            return;
          }
          latestPart.status = status.name;
          await GenalDB.put('parts', latestPart);
          await syncAppointmentsForPart(latestPart);
          closeMenu();
          renderPartsList();
          showToast('Estado del parte actualizado.');
        });
        menu.appendChild(option);
      });
      document.body.appendChild(menu);
      const cellRect = statusCell.getBoundingClientRect();
      const menuWidth = Math.min(240, Math.max(190, window.innerWidth - 24));
      const menuHeight = Math.min(statuses.length * 35 + 12, 320);
      menu.style.width = `${menuWidth}px`;
      if(window.innerWidth <= 600){
        menu.classList.add('inline-status-menu-mobile');
      }else{
        const openAbove = cellRect.bottom + menuHeight > window.innerHeight && cellRect.top > menuHeight;
        const preferredLeft = cellRect.left;
        const left = Math.min(Math.max(8, preferredLeft), window.innerWidth - menuWidth - 8);
        const preferredTop = openAbove ? cellRect.top - menuHeight - 4 : cellRect.bottom + 4;
        const top = Math.min(Math.max(8, preferredTop), window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
      }
      const closeMenu = ()=>{
        menu.remove();
        document.removeEventListener('click', outsideClick);
      };
      const outsideClick = outsideEvent=>{
        if(!statusCell.contains(outsideEvent.target) && !menu.contains(outsideEvent.target)) closeMenu();
      };
      document.addEventListener('click', outsideClick);
      menu.querySelector('.inline-status-option[aria-selected="true"]')?.focus();
      /*
       * Keep the menu open after the first click so the available colours
       * remain visible and selectable without relying on the native select UI.
       */
      return;
    });
    row.querySelectorAll('[data-action="preview-report"]').forEach(button=>button.addEventListener('click', ()=>previewPart(p.id)));
    row.querySelectorAll('[data-action="pdf-report"]').forEach(button=>button.addEventListener('click', ()=>exportPartPDF(p.id)));
    row.querySelectorAll('[data-action="part-budget"]').forEach(button=>button.addEventListener('click', async ()=>{
      const invoices = await GenalDB.getAll('invoices');
      const appointments = await GenalDB.getAll('appointments');
      const linkedInvoice = invoices.find(invoice=>Number(invoice.fromPart) === Number(p.id));
      if(linkedInvoice || p.invoiced === true){
        showToast(linkedInvoice ? `No se puede crear un presupuesto porque el parte ya tiene la factura ${linkedInvoice.number}.` : 'No se puede crear un presupuesto porque el parte ya está facturado.', 'error');
        return;
      }
      await openBudgetFromPartModal(p.id);
    }));
    row.querySelectorAll('[data-action="part-invoice"]').forEach(button=>button.addEventListener('click', ()=>createInvoiceFromPart(p.id)));
    row.querySelectorAll('[data-action="edit-part"]').forEach(button=>button.addEventListener('click', ()=>editPart(p.id)));
    row.querySelectorAll('[data-action="del"]').forEach(button=>button.addEventListener('click', async ()=>{
      const linkedBudget = (await GenalDB.getAll('budgets')).find(budget=>Number(budget.fromPart) === Number(p.id));
      if(linkedBudget){ showToast(`No se puede eliminar el parte porque tiene vinculado el presupuesto ${linkedBudget.number}.`, 'error'); return; }
      if(await showConfirmModal(`¿Eliminar el parte ${p.number || ''}?`)){
        await returnPartStockOnDeletion(p);
        await GenalDB.remove('parts', p.id);
        renderPartsList(); renderStockList(); renderMovesList();
      }
    }));
    row.addEventListener('click', event=>{
      if(event.target.closest('button,input,select')) return;
      openPartDetailsModal(p.id);
    });
  });
  const bulk = document.querySelector('[data-bulk-type="parts"]');
  const updateBulkVisibility = bulk ? setupBulkToolbarVisibility(bulk, wrap) : null;
  table.querySelector('[data-table-select-all]').addEventListener('change', event=>{
    wrap.querySelectorAll('.row-select').forEach(input=>input.checked = event.target.checked);
    updateBulkVisibility?.();
  });
  if(bulk){
    bulk.querySelector('[data-select-all]').onchange = event=>{
      wrap.querySelectorAll('.row-select').forEach(input=>input.checked = event.target.checked);
      updateBulkVisibility?.();
    };
    bulk.querySelector('[data-bulk-action="delete"]').onclick = async ()=>{
      const selectedIds = [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId));
      if(!selectedIds.length || !await showConfirmModal(`¿Eliminar los ${selectedIds.length} partes seleccionados?`)) return;
      for(const id of selectedIds){
        const linked = (await GenalDB.getAll('budgets')).some(budget=>Number(budget.fromPart) === id);
        const part = await GenalDB.get('parts', id);
        if(part && !linked){ await returnPartStockOnDeletion(part); await GenalDB.remove('parts', id); }
      }
      renderPartsList(); renderStockList(); renderMovesList();
    };
    bulk.querySelector('[data-bulk-action="download"]').onclick = async ()=>{
      for(const id of [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId))) await exportPartPDF(id);
    };
  }
  appendPagination(wrap, 'parts', total, renderPartsList);
}

async function renderPartsList(){
  if(window._mobileFilterOpen) return;
  const parts = await GenalDB.getAll('parts');
  const wrap = document.getElementById('parts-list'); if(!wrap) return; wrap.innerHTML='';
  if(parts.length===0){ wrap.innerHTML='<p class="small">No hay informes todavía.</p>'; return; }
  const settings = await GenalDB.get('settings','config') || {};
  const technicianMode = Boolean(settings.streetTechnicianMode);
  const todayKey = localDateKey(new Date());
  const appointmentsByPart = new Map();
  const pendingTodayParts = new Set();
  {
    const appointments = await GenalDB.getAll('appointments');
    for(const appointment of appointments){
      const partId = Number(appointment.partId);
      if(!appointmentsByPart.has(partId)) appointmentsByPart.set(partId, []);
      appointmentsByPart.get(partId).push(appointment);
      if(localDateKey(appointment.dateTime) === todayKey && appointment.status !== 'Finalizada'){
        pendingTodayParts.add(partId);
      }
    }
    for(const items of appointmentsByPart.values()) items.sort((a,b)=>new Date(a.dateTime)-new Date(b.dateTime));
  }
  const filterValue = id => (document.getElementById(id)?.value || '').trim().toLocaleLowerCase();
  const filters = {
    number: filterValue('filter-part-number'),
    dateMode: document.getElementById('filter-part-date-mode')?.value || 'single',
    date: document.getElementById('filter-part-date')?.value || '',
    dateFrom: document.getElementById('filter-part-date-from')?.value || '',
    dateTo: document.getElementById('filter-part-date-to')?.value || '',
    client: filterValue('filter-part-client'),
    brand: filterValue('filter-part-brand'),
    model: filterValue('filter-part-model'),
    sn: filterValue('filter-part-sn'),
    problem: filterValue('filter-part-problem'),
    work: filterValue('filter-part-work'),
    pieces: filterValue('filter-part-pieces'),
    status: filterValue('filter-part-status')
    ,type: filterValue('filter-part-type')
  };
  const hasDirectSearch = Object.entries(filters).some(([key, value]) =>
    key !== 'dateMode' && typeof value === 'string' && value.trim() !== ''
  );
  const searchableParts = [];
  for(const p of parts){
    if(technicianMode && !hasDirectSearch && !pendingTodayParts.has(Number(p.id))) continue;
    const client = await GenalDB.get('clients', p.clientId);
    const pieces = p.pieces || p.lines || [];
    const pieceNames = [];
    for(const piece of pieces){
      const product = piece.productId ? await GenalDB.get('products', piece.productId) : null;
      if(product) pieceNames.push(`${product.code || ''} ${product.name || ''}`);
      else if(piece.description) pieceNames.push(piece.description);
    }
    const device = p.device || {};
    const displayStatus = p.status === 'Terminado' ? 'Finalizado' : (p.status || 'Pte revisión');
    const matches = (value, filter) => !filter || String(value || '').toLocaleLowerCase().includes(filter);
    const createdDate = new Date(p.createdAt).toISOString().slice(0, 10);
    if(
      matches(p.number, filters.number) &&
      (filters.dateMode === 'single'
        ? (!filters.date || createdDate === filters.date)
        : ((!filters.dateFrom || createdDate >= filters.dateFrom) &&
          (!filters.dateTo || createdDate <= filters.dateTo))) &&
      matches(getClientDisplayName(client), filters.client) &&
      matches(p.type, filters.type) &&
      matches(device.brand, filters.brand) &&
      matches(device.model, filters.model) &&
      matches(device.serialNumber, filters.sn) &&
      matches(p.customerProblem || p.desc, filters.problem) &&
      matches(p.technicianWork, filters.work) &&
      matches(pieceNames.join(' '), filters.pieces) &&
      (!filters.status || displayStatus.toLocaleLowerCase() === filters.status)
    ){
      searchableParts.push({part:{...p, appointments:appointmentsByPart.get(Number(p.id)) || []}, client, pieces, pieceNames});
    }
  }

  function openAttachmentViewer(attachments, initialIndex){
    if(!attachments?.length) return;
    let modal = document.getElementById('attachment-viewer');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'attachment-viewer';
      modal.className = 'modal attachment-viewer';
      modal.innerHTML = `
        <div class="attachment-viewer-content" role="dialog" aria-modal="true" aria-label="Visor de archivos">
          <button type="button" class="attachment-viewer-close" aria-label="Cerrar visor">×</button>
          <button type="button" class="attachment-viewer-nav prev" aria-label="Archivo anterior">‹</button>
          <div class="attachment-viewer-stage"></div>
          <button type="button" class="attachment-viewer-nav next" aria-label="Archivo siguiente">›</button>
          <div class="attachment-viewer-caption"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('.attachment-viewer-close').addEventListener('click', closeAttachmentViewer);
      modal.addEventListener('click', event=>{
        if(event.target === modal) closeAttachmentViewer();
      });
    }
    modal._attachments = attachments;
    modal._index = initialIndex;
    modal.querySelector('.prev').onclick = ()=>moveAttachmentViewer(-1);
    modal.querySelector('.next').onclick = ()=>moveAttachmentViewer(1);
    renderAttachmentViewer();
    modal.classList.add('show');
  }

  async function renderAttachmentViewer(){
    const modal = document.getElementById('attachment-viewer');
    if(!modal) return;
    const attachments = modal._attachments || [];
    if(!attachments.length) return closeAttachmentViewer();
    modal._index = (modal._index + attachments.length) % attachments.length;
    const attachment = attachments[modal._index];
    const stage = modal.querySelector('.attachment-viewer-stage');
    stage.innerHTML = '';
    const media = attachment.type?.startsWith('video/')
      ? document.createElement('video')
      : document.createElement('img');
    const mediaUrl = await resolveAttachmentUrl(attachment);
    if(!mediaUrl) return;
    media.src = mediaUrl;
    media.alt = attachment.name || 'Archivo adjunto';
    if(media.tagName === 'VIDEO'){
      media.controls = true;
      media.autoplay = true;
    }
    stage.appendChild(media);
    modal.querySelector('.attachment-viewer-caption').textContent =
      `${attachment.name || 'Archivo adjunto'} · ${modal._index + 1} de ${attachments.length}`;
    modal.querySelector('.prev').hidden = attachments.length < 2;
    modal.querySelector('.next').hidden = attachments.length < 2;
  }

  function moveAttachmentViewer(direction){
    const modal = document.getElementById('attachment-viewer');
    if(!modal) return;
    modal._index += direction;
    renderAttachmentViewer();
  }

  function closeAttachmentViewer(){
    const modal = document.getElementById('attachment-viewer');
    if(!modal) return;
    const video = modal.querySelector('video');
    if(video) video.pause();
    modal.classList.remove('show');
  }

  document.addEventListener('keydown', event=>{
    const modal = document.getElementById('attachment-viewer');
    if(!modal?.classList.contains('show')) return;
    if(event.key === 'Escape') closeAttachmentViewer();
    if(event.key === 'ArrowLeft') moveAttachmentViewer(-1);
    if(event.key === 'ArrowRight') moveAttachmentViewer(1);
  });
  if(searchableParts.length===0){ wrap.innerHTML='<p class="small">No hay informes que coincidan con la búsqueda.</p>'; return; }
  const sortedParts = technicianMode
    ? searchableParts.slice().sort((a, b)=>{
      const getAppointmentTimestamp = item=>{
        const appointment = (item.part.appointments || [])
          .filter(entry=>localDateKey(entry.dateTime) === todayKey && entry.status !== 'Finalizada')
          .sort((first, second)=>new Date(first.dateTime) - new Date(second.dateTime))[0];
        return appointment ? new Date(appointment.dateTime).getTime() : Number.POSITIVE_INFINITY;
      };
      const timeDifference = getAppointmentTimestamp(a) - getAppointmentTimestamp(b);
      if(timeDifference !== 0) return timeDifference;
      return String(a.part.number || '').localeCompare(String(b.part.number || ''), 'es', {numeric:true});
    })
    : sortByText(searchableParts, item=>item.part.number, 'parts');
  const pageData = pagedItems(sortedParts, 'parts');
  return renderPartsTable(wrap, pageData, sortedParts.length, technicianMode);
  pageData.items.forEach(({part:p, client, pieces})=>{
    const div = document.createElement('div'); div.className='card part-card';
    wrap.appendChild(div);
    const linesHtml = pieces.map(async l=>{
      const prod = l.productId ? await GenalDB.get('products', l.productId) : null;
      return `<li>${l.description || prod?.name || '(pieza eliminada)'} x ${l.qty}</li>`;
    });
    const device = p.device || {};
    const displayStatus = p.status === 'Terminado' ? 'Finalizado' : (p.status || 'Pte revisión');
    Promise.all(linesHtml).then(pieceHtml=>{
      const equipment = [device.brand, device.model].filter(Boolean).join(' ') || 'Equipo no especificado';
      div.innerHTML = `
        <div class="part-summary" tabindex="0" role="button" aria-expanded="false">
          <input type="checkbox" class="row-select" data-row-id="${p.id}" aria-label="Seleccionar ${p.number}">
          <div class="part-summary-main">
            <strong>${p.number || 'Informe antiguo'}</strong>
            <span>${new Date(p.createdAt).toLocaleDateString()}</span>
            <span><strong>Cliente:</strong> ${getClientDisplayName(client)}</span>
            <span><strong>Tipo:</strong> ${p.type || '—'}</span>
            <span><strong>Modelo:</strong> ${device.model || '—'}</span>
            <span><strong>Marca:</strong> ${device.brand || '—'}</span>
            <span><strong>Nº serie:</strong> ${device.serialNumber || '—'}</span>
            <span class="part-status" data-status-name="${displayStatus}">${displayStatus}</span>
          </div>
          <div class="part-actions">
            <button class="icon-btn" title="Vista previa" aria-label="Vista previa" data-id="${p.id}" data-action="preview-report">👁</button>
            <button class="icon-btn pdf-action" title="Exportar PDF" aria-label="Exportar PDF" data-id="${p.id}" data-action="pdf-report"><span>PDF</span></button>
            <button class="icon-btn" title="Crear presupuesto" aria-label="Crear presupuesto" data-id="${p.id}" data-action="part-budget">💶</button>
            <button class="icon-btn invoice-action" title="Crear factura" aria-label="Crear factura" data-id="${p.id}" data-action="part-invoice"><span>$</span></button>
            <button class="icon-btn edit-action" title="Modificar parte" aria-label="Modificar parte" data-id="${p.id}" data-action="edit-part">✎</button>
            <button class="icon-btn danger" title="Eliminar" aria-label="Eliminar" data-id="${p.id}" data-action="del">🗑</button>
          </div>
        </div>
        <div class="part-details" hidden>
          <p><strong>Cliente:</strong> ${getClientDisplayName(client)} · <strong>Teléfono:</strong> ${client?.phone || client?.contact || '—'} · <strong>Dirección:</strong> ${client?.address || '—'}</p>
          <p><strong>Equipo:</strong> ${device.brand||'—'} ${device.model||''} ${device.serialNumber ? `· SN: ${device.serialNumber}` : ''}</p>
          <p><strong>Problema del cliente:</strong> ${p.customerProblem || p.desc || '—'}</p>
          <p><strong>Trabajos realizados:</strong> ${p.technicianWork || '—'}</p>
          <h4>Piezas utilizadas</h4>
          <table class="table part-lines-table"><thead><tr><th>Pieza</th><th>Cantidad</th></tr></thead><tbody>${pieceHtml.join('').replace(/<li>(.*?) x (.*?)<\/li>/g, '<tr><td>$1</td><td>$2</td></tr>') || '<tr><td colspan="2" class="small">Ninguna</td></tr>'}</tbody></table>
          <p><strong>Fotos y vídeos:</strong></p>
          <div class="part-attachments"></div>
          <label class="attachment-add-label">Añadir fotos o vídeos
            <input class="part-attachment-input" type="file" accept="image/*,video/*" multiple>
          </label>
        </div>`;
      const partIsFinalized = isFinalizedPartStatus(p.status);
      getPartSettings().then(({statuses})=>{ const found=statuses.find(s=>s.name===displayStatus); if(found) div.querySelector('.part-status').style.backgroundColor=found.color; if(found) div.querySelector('.part-status').style.color='#fff'; });
      renderAttachmentList(p.attachments || [], div.querySelector('.part-attachments'), false, partIsFinalized ? null : async index=>{
        const currentPart = await GenalDB.get('parts', p.id);
        if(!currentPart) return;
        if(!confirm(`¿Eliminar el archivo "${currentPart.attachments?.[index]?.name || 'adjunto'}"?`)) return;
        const removedAttachment = currentPart.attachments?.[index];
        if(removedAttachment?.driveFileId){
          try{
            await GenalDrive.remove(removedAttachment.driveFileId);
          }catch(error){
            console.error('No se pudo eliminar el archivo de Google Drive.', error);
            showToast('No se pudo eliminar el archivo de Google Drive.', 'error');
            return;
          }
        }
        currentPart.attachments = (currentPart.attachments || []).filter((_, attachmentIndex)=>attachmentIndex !== index);
        await GenalDB.put('parts', currentPart);
        renderPartsList();
      });
      const attachmentInput = div.querySelector('.part-attachment-input');
      attachmentInput.disabled = partIsFinalized;
      attachmentInput.title = partIsFinalized
        ? 'Los partes finalizados no se pueden modificar'
        : 'Añadir fotos o vídeos';
      attachmentInput.addEventListener('pointerdown', prepareDriveAccess);
      attachmentInput.addEventListener('change', event=>addAttachmentsToPart(p, event));
      const summary = div.querySelector('.part-summary');
      summary.addEventListener('click', ()=>openPartDetailsModal(p.id));
      summary.addEventListener('keydown', event=>{
        if(event.key === 'Enter' || event.key === ' '){
          event.preventDefault();
          openPartDetailsModal(p.id);
        }
      });
      div.querySelector('[data-action="preview-report"]').addEventListener('click', ()=>previewPart(p.id));
      div.querySelector('[data-action="pdf-report"]').addEventListener('click', ()=>exportPartPDF(p.id));
      div.querySelector('[data-action="part-budget"]').addEventListener('click', async ()=>{
        const invoices = await GenalDB.getAll('invoices');
        const linkedInvoice = invoices.find(invoice=>Number(invoice.fromPart) === Number(p.id));
        if(linkedInvoice || p.invoiced === true){
          showToast(linkedInvoice
            ? `No se puede crear un presupuesto porque el parte ya tiene la factura ${linkedInvoice.number}.`
            : 'No se puede crear un presupuesto porque el parte ya está facturado.', 'error');
          return;
        }
        await openBudgetFromPartModal(p.id);
      });
      div.querySelector('[data-action="part-invoice"]').addEventListener('click', async ()=>{
        await createInvoiceFromPart(p.id);
      });
      div.querySelector('[data-action="edit-part"]').addEventListener('click', ()=>editPart(p.id));
      div.querySelector('[data-action="del"]').addEventListener('click', async ()=>{
        const linkedBudget = (await GenalDB.getAll('budgets')).find(budget=>Number(budget.fromPart) === Number(p.id));
        if(linkedBudget){ showToast(`No se puede eliminar el parte porque tiene vinculado el presupuesto ${linkedBudget.number}.`, 'error'); return; }
        if(await showConfirmModal(`¿Eliminar el parte ${p.number || ''}?`)){
          await returnPartStockOnDeletion(p);
          await GenalDB.remove('parts', p.id);
          renderPartsList();
          renderStockList();
          renderMovesList();
        }
      });
      div.querySelectorAll('.part-actions button').forEach(button=>button.addEventListener('click', event=>event.stopPropagation()));
      div.querySelector('.row-select').addEventListener('click', event=>event.stopPropagation());
    });
  });
  const bulk = document.querySelector('[data-bulk-type="parts"]');
  if(bulk){
    const selectAll = checked=>wrap.querySelectorAll('.row-select').forEach(input=>input.checked=checked);
    bulk.querySelector('[data-select-all]').onchange = event=>selectAll(event.target.checked);
    setupBulkToolbarVisibility(bulk, wrap);
    bulk.querySelector('[data-bulk-action="delete"]').onclick = async ()=>{
      const selectedIds = [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId));
      if(!selectedIds.length) return;
      if(!await showConfirmModal(`¿Eliminar los ${selectedIds.length} partes seleccionados?`)) return;
      let skipped = 0;
      for(const id of selectedIds){
        const linked = (await GenalDB.getAll('budgets')).some(budget=>Number(budget.fromPart) === id);
        if(!linked){
          const part = await GenalDB.get('parts', id);
          if(part){
            await returnPartStockOnDeletion(part);
            await GenalDB.remove('parts', id);
          }
        }
        else skipped++;
      }
      if(skipped) showToast(`${skipped} parte(s) no se eliminaron porque tienen presupuesto vinculado.`, 'error');
      renderPartsList();
      renderStockList();
      renderMovesList();
    };
    bulk.querySelector('[data-bulk-action="download"]').onclick = async ()=>{
      for(const id of [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId))) await exportPartPDF(id);
    };
  }
}

async function openPartDetailsModal(partId){
  const part = await GenalDB.get('parts', partId);
  if(!part) return;
  const client = await GenalDB.get('clients', part.clientId);
  const budgets = (await GenalDB.getAll('budgets')).filter(budget=>Number(budget.fromPart) === Number(partId));
  const invoices = (await GenalDB.getAll('invoices')).filter(invoice=>Number(invoice.fromPart) === Number(partId));
  const appointments = (await GenalDB.getAll('appointments')).filter(item=>Number(item.partId) === Number(partId)).sort((a,b)=>new Date(a.dateTime)-new Date(b.dateTime));
  const device = part.device || {};
  const pieces = part.pieces || part.lines || [];
  const products = await Promise.all(pieces.map(piece=>piece.productId ? GenalDB.get('products', piece.productId) : null));
  const pieceRows = pieces.map((piece,index)=>`<tr><td>${piece.description || products[index]?.name || '(pieza eliminada)'}</td><td>${piece.qty}</td><td>${piece.productId && piece.deductStock !== false ? 'Sí' : 'No'}</td></tr>`).join('');
  const budgetHtml = budgets.map(budget=>`<li><button class="link-button" data-open-budget="${budget.id}">${budget.number}</button> · ${fmtCurrency(budget.total)}</li>`).join('') || '<li>Ninguno</li>';
  const invoiceHtml = invoices.map(invoice=>`<li><button class="link-button" data-open-invoice="${invoice.id}">${invoice.number}</button> · ${fmtCurrency(invoice.total)} · ${invoice.issued ? 'Emitida' : 'Pendiente'}</li>`).join('') || '<li>Ninguna</li>';
  const appointmentHtml = appointments.map(item=>`<li>${agendaDateTimeLabel(item.dateTime)}${item.notes ? ` · ${item.notes}` : ''}</li>`).join('') || '<li>Ninguna</li>';
  document.getElementById('part-details-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'part-details-modal';
  modal.className = 'modal part-details-modal show';
  modal.innerHTML = `<div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="part-details-title">
    <div class="modal-header"><h3 id="part-details-title">${part.number || 'Informe de trabajo'}</h3><button type="button" class="close-btn" aria-label="Cerrar">×</button></div>
    <div class="modal-body">
      <div class="part-detail-section part-detail-overview">
        <div class="part-detail-field"><span class="part-detail-label">Fecha</span><strong>${part.createdAt ? new Date(part.createdAt).toLocaleString() : '—'}</strong></div>
        <div class="part-detail-field"><span class="part-detail-label">Estado</span><strong class="part-detail-status">${part.status || 'Pte revisión'}</strong></div>
      </div>
      <div class="part-detail-grid">
        <section class="part-detail-section"><h4>Cliente</h4><dl class="part-detail-data">
          <div><dt>Nombre</dt><dd>${getClientDisplayName(client)}</dd></div>
          <div><dt>Teléfono</dt><dd>${client?.phone || client?.contact || '—'}</dd></div>
          <div><dt>Dirección</dt><dd>${client?.address || '—'}, ${client?.postalCode || ''} ${client?.locality || ''} ${client?.province || ''}</dd></div>
        </dl></section>
        <section class="part-detail-section"><h4>Equipo</h4><dl class="part-detail-data">
          <div><dt>Marca</dt><dd>${device.brand || '—'}</dd></div>
          <div><dt>Modelo</dt><dd>${device.model || '—'}</dd></div>
          <div><dt>Nº serie</dt><dd>${device.serialNumber || '—'}</dd></div>
        </dl></section>
      </div>
      <div class="part-detail-grid">
        <section class="part-detail-section"><h4>Problema del cliente</h4><p class="part-detail-text">${part.customerProblem || part.desc || '—'}</p></section>
        <section class="part-detail-section"><h4>Trabajos realizados</h4><p class="part-detail-text">${part.technicianWork || '—'}</p></section>
      </div>
      <section class="part-detail-section"><h4>Citas</h4><ul class="part-detail-list">${appointmentHtml}</ul></section>
      <section class="part-detail-section"><h4>Piezas utilizadas</h4><table class="table part-lines-table"><thead><tr><th>Pieza</th><th>Cantidad</th><th>Descontar stock</th></tr></thead><tbody>${pieceRows || '<tr><td colspan="3" class="small">Ninguna</td></tr>'}</tbody></table></section>
      <div class="part-related-links"><div class="part-detail-section"><h4>Presupuestos vinculados</h4><ul class="part-detail-list">${budgetHtml}</ul></div><div class="part-detail-section"><h4>Facturas vinculadas</h4><ul class="part-detail-list">${invoiceHtml}</ul></div></div>
      <div class="part-details-actions" aria-label="Acciones del informe">
        <button type="button" class="btn" data-part-detail-action="preview"><span class="preview-action-icon" aria-hidden="true">👁</span><span>Vista previa</span></button>
        <button type="button" class="btn secondary" data-part-detail-action="pdf"><span class="preview-action-icon" aria-hidden="true">📄</span><span>Exportar PDF</span></button>
        <button type="button" class="btn" data-part-detail-action="budget"><span class="preview-action-icon" aria-hidden="true">💶</span><span>Crear presupuesto</span></button>
        <button type="button" class="btn" data-part-detail-action="invoice"><span class="preview-action-icon" aria-hidden="true">$</span><span>Crear factura</span></button>
        <button type="button" class="btn secondary" data-part-detail-action="edit"><span class="preview-action-icon" aria-hidden="true">✎</span><span>Modificar parte</span></button>
        <button type="button" class="btn danger" data-part-detail-action="delete"><span class="preview-action-icon" aria-hidden="true">🗑</span><span>Eliminar</span></button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  const close = ()=>modal.remove();
  modal.querySelector('.close-btn').addEventListener('click', close);
  modal.addEventListener('click', event=>{ if(event.target === modal) close(); });
  modal.querySelector('[data-part-detail-action="preview"]').addEventListener('click', async ()=>{
    close();
    await previewPart(part.id);
  });
  modal.querySelector('[data-part-detail-action="pdf"]').addEventListener('click', async ()=>{
    close();
    await exportPartPDF(part.id);
  });
  modal.querySelector('[data-part-detail-action="budget"]').addEventListener('click', async ()=>{
    close();
    await openBudgetFromPartModal(part.id);
  });
  modal.querySelector('[data-part-detail-action="invoice"]').addEventListener('click', async ()=>{
    close();
    await createInvoiceFromPart(part.id);
  });
  modal.querySelector('[data-part-detail-action="edit"]').addEventListener('click', async ()=>{
    close();
    await editPart(part.id);
  });
  modal.querySelector('[data-part-detail-action="delete"]').addEventListener('click', async ()=>{
    const linkedBudget = (await GenalDB.getAll('budgets')).find(budget=>Number(budget.fromPart) === Number(part.id));
    if(linkedBudget){
      showToast(`No se puede eliminar el parte porque tiene vinculado el presupuesto ${linkedBudget.number}.`, 'error');
      return;
    }
    if(!await showConfirmModal(`¿Eliminar el parte ${part.number || ''}?`)) return;
    await returnPartStockOnDeletion(part);
    await GenalDB.remove('parts', part.id);
    close();
    renderPartsList();
    renderStockList();
    renderMovesList();
  });
  modal.querySelectorAll('[data-open-budget]').forEach(button=>button.addEventListener('click', async ()=>{
    close();
    await openRecordPreview('budgets', Number(button.dataset.openBudget));
  }));
  modal.querySelectorAll('[data-open-invoice]').forEach(button=>button.addEventListener('click', async ()=>{
    close();
    await openRecordPreview('invoices', Number(button.dataset.openInvoice));
  }));
}

async function addAttachmentsToPart(part, event){
  const files = Array.from(event.target.files || []);
  if(!files.length) return;
  const attachments = part.attachments || [];
  for(const file of files){
    try{
      attachments.push(await GenalDrive.upload(file));
    }catch(error){
      console.error('No se pudo subir el adjunto a Google Drive.', error);
      showToast(`No se pudo subir ${file.name}: ${error.message || 'error de Google Drive'}`, 'error');
    }
  }
  part.attachments = attachments;
  await GenalDB.put('parts', part);
  event.target.value = '';
  renderPartsList();
}

const DOCUMENT_STYLE = `<style>
  .genal-document{box-sizing:border-box;width:100%;max-width:800px;margin:0 auto;padding:34px 38px;color:#263238;background:#fff;border:1px solid #d9e1e5;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.45}
  .genal-document *{box-sizing:border-box}
  .genal-document > div:first-of-type{padding-bottom:18px;border-bottom:2px solid #1d6474}
  .genal-document > div:first-of-type strong{color:#1d6474;font-size:15px}
  .genal-document h2,.genal-document h3{color:#174d5b;line-height:1.2}
  .genal-document h2{margin:24px 0 6px;font-size:23px;letter-spacing:-.2px}
  .genal-document h3{margin:22px 0 8px;padding-bottom:5px;border-bottom:1px solid #d9e1e5;font-size:14px;text-transform:uppercase;letter-spacing:.35px}
  .genal-document p{margin:8px 0 14px}
  .genal-document table{width:100%;margin:18px 0;border-collapse:collapse;border:1px solid #d9e1e5;font-size:12.5px}
  .genal-document th{padding:9px 10px;background:#edf4f5;color:#174d5b;text-align:right;border-bottom:2px solid #9fc2c9}
  .genal-document th:first-child{text-align:left}
  .genal-document td{padding:9px 10px;border-bottom:1px solid #e5ebed}
  .genal-document tbody tr:nth-child(even){background:#f8fafb}
  .genal-document tbody tr:last-child td{border-bottom:0}
  .genal-document img{display:block;max-height:80px;max-width:160px;object-fit:contain}
  @media print{.genal-document{max-width:none;border:0;margin:0;padding:0;box-shadow:none}.genal-document h3{break-after:avoid}.genal-document table{break-inside:auto}.genal-document tr{break-inside:avoid}}
</style><div class="genal-document">`;
function documentStart(){ return DOCUMENT_STYLE; }

function buildPartReportHTML(part, client, cfg, appointments=[]){
  const company = cfg.company || {};
  const logoSrc = cfg.logo || '';
  const device = part.device || {};
  const pieces = part.pieces || part.lines || [];
  let html = documentStart();
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">`;
  if(logoSrc) html += `<div style="flex:0 0 160px"><img src="${logoSrc}" alt="logo" style="max-height:80px;max-width:160px;object-fit:contain"></div>`;
  html += `<div style="flex:1;text-align:right"><strong>${company.name||'Mi Empresa'}</strong><br>`;
  const companyAddress = [company.address, [company.postal, company.city, company.province].filter(Boolean).join(' ')].filter(Boolean);
  if(companyAddress.length) html += companyAddress.join('<br>') + '<br>';
  if(company.tax) html += `CIF/NIF: ${company.tax}<br>`;
  if(company.phone) html += `Tel: ${company.phone}<br>`;
  if(company.email) html += `${company.email}<br>`;
  html += `</div></div>`;
  html += `<h2 style="margin:8px 0">Informe de trabajo ${part.number || ''}</h2>`;
  html += `<p><strong>Fecha:</strong> ${new Date(part.createdAt).toLocaleString()}</p>`;
  html += `<h3>Datos del cliente</h3>`;
  html += `<p><strong>Nombre:</strong> ${getClientDisplayName(client)}<br>`;
  if(client?.address) html += `${client.address}<br>`;
  const clientLocation = [client?.postalCode, client?.locality, client?.province].filter(Boolean).join(' ');
  if(clientLocation) html += `${clientLocation}<br>`;
  html += `<strong>Teléfono:</strong> ${client?.phone || client?.contact || '—'}</p>`;
  html += `<h3>Producto revisado</h3>`;
  html += `<p><strong>Marca:</strong> ${device.brand || '—'} &nbsp; <strong>Modelo:</strong> ${device.model || '—'} &nbsp; <strong>SN:</strong> ${device.serialNumber || '—'}</p>`;
  html += `<h3>Problema detectado por el cliente</h3><p style="white-space:pre-wrap">${part.customerProblem || part.desc || '—'}</p>`;
  html += `<h3>Trabajos realizados por el técnico</h3><p style="white-space:pre-wrap">${part.technicianWork || '—'}</p>`;
  html += `<h3>Piezas utilizadas</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;border-bottom:1px solid #ccc">Pieza</th><th style="border-bottom:1px solid #ccc">Cantidad</th></tr></thead><tbody>`;
  for(const piece of pieces){
    const product = piece.productId ? window._partProductsCache?.[piece.productId] : null;
    html += `<tr><td style="padding:6px 0">${piece.description || product?.name || 'Pieza'}</td><td style="text-align:center">${piece.qty}</td></tr>`;
  }
  html += `</tbody></table></div>`;
  return html;
}

async function getPartReportHTML(partId){
  const part = await GenalDB.get('parts', partId);
  if(!part){ showToast('Informe no encontrado', 'error'); return null; }
  const client = await GenalDB.get('clients', part.clientId);
  const cfg = await getConfig();
  const appointments = (await GenalDB.getAll('appointments')).filter(item=>Number(item.partId) === Number(partId)).sort((a,b)=>new Date(a.dateTime)-new Date(b.dateTime));
  window._partProductsCache = {};
  for(const piece of (part.pieces || part.lines || [])){
    if(piece.productId){
      const product = await GenalDB.get('products', piece.productId);
      window._partProductsCache[piece.productId] = product;
    }
  }
  return { part, html: buildPartReportHTML(part, client, cfg, appointments) };
}

async function previewPart(partId){
  const report = await getPartReportHTML(partId);
  if(report) showPreview(report.html, `${report.part.number || 'informe'}.pdf`, [
    {label:'Modificar parte', className:'edit-action', handler:()=>editPart(partId)},
    {label:'Crear presupuesto', handler:()=>createBudgetFromPart(partId)},
    {label:'Crear factura', className:'invoice-action', handler:()=>createInvoiceFromPart(partId)}
  ]);
}

async function exportPartPDF(partId){
  const report = await getPartReportHTML(partId);
  if(!report) return;
  const opt = { margin: 10, filename: `${report.part.number || 'informe'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
  const el = document.createElement('div'); el.innerHTML = report.html; document.body.appendChild(el);
  try{ await html2pdf().from(el).set(opt).save(); }catch(err){ showToast('Error generando PDF del informe', 'error'); }
  el.remove();
}

/* Budgets & Invoices helpers */
async function getConfig(){
  return await GenalDB.get('settings','config');
}
function fmtCurrency(amount){
  // read current currency from settings if available
  const cfg = window._lastCfg || null;
  const cur = (cfg && cfg.currency) ? cfg.currency : 'EUR';
  return cur === 'EUR' ? `${Number(amount || 0).toFixed(2)} €` : `${Number(amount || 0).toFixed(2)} ${cur}`;
}

/* Budget helpers */
function addBudgetLine(){
  const desc = document.getElementById('b-item-desc').value.trim();
  const qty = Number(document.getElementById('b-item-qty').value) || 1;
  const price = Number(document.getElementById('b-item-price').value) || 0.0;
  if(!desc){ showToast('Descripción de línea requerida', 'error'); return; }
  window._budgetLines = window._budgetLines || [];
  window._budgetLines.push({desc,qty,price});
  document.getElementById('b-item-desc').value=''; document.getElementById('b-item-qty').value=1; document.getElementById('b-item-price').value='';
  renderBudgetLines();
}
async function renderBudgetLines(){
  const wrap = document.getElementById('b-lines-list'); if(!wrap) return; wrap.innerHTML='';
  const cfg = await getConfig(); window._lastCfg = cfg;
  let subtotal = 0;
  (window._budgetLines||[]).forEach((l,i)=>{
    const div = document.createElement('div'); div.textContent = `${l.desc} - ${l.qty} x ${fmtCurrency(l.price)} = ${fmtCurrency(l.qty*l.price)}`;
    const btn = document.createElement('button'); btn.textContent='Quitar'; btn.className='btn secondary'; btn.style.marginLeft='8px';
    btn.addEventListener('click', ()=>{ window._budgetLines.splice(i,1); renderBudgetLines(); });
    div.appendChild(btn); wrap.appendChild(div);
    subtotal += (l.qty * l.price);
  });
  const totalsDiv = document.createElement('div'); totalsDiv.className='small';
  const vat = cfg?.vat_percent || 0;
  const vatAmount = subtotal * vat / 100;
  const total = subtotal + vatAmount;
  totalsDiv.innerHTML = `<strong>Subtotal:</strong> ${fmtCurrency(subtotal)} &nbsp; <strong>IVA ${vat}%:</strong> ${fmtCurrency(vatAmount)} &nbsp; <strong>Total:</strong> ${fmtCurrency(total)}`;
  wrap.appendChild(totalsDiv);
}

async function createBudget(){
  const clientId = Number(document.getElementById('b-client').value);
  const desc = document.getElementById('b-desc').value.trim();
  if(!clientId){ showToast('Selecciona cliente', 'error'); return; }
  const lines = (window._budgetLines||[]).slice();
  if(lines.length===0){ if(!confirm('Crear presupuesto sin líneas?')) return; }
  const cfg = await getConfig(); window._lastCfg = cfg;
  const subtotal = lines.reduce((s,l)=> s + l.qty*l.price, 0);
  const vatAmount = subtotal * (cfg.vat_percent||0) / 100;
  const total = subtotal + vatAmount;
  const number = `P-${String(cfg.budget_next||1).padStart(6,'0')}`;
  const budget = { number, clientId, desc, lines, subtotal, vat_percent:cfg.vat_percent||0, vatAmount, total, createdAt:new Date().toISOString() };
  await GenalDB.add('budgets', budget);
  cfg.budget_next = (cfg.budget_next||1) + 1;
  await GenalDB.put('settings', cfg);
  window._budgetLines = [];
  document.getElementById('b-desc').value='';
  renderBudgetLines();
  renderBudgetsList();
  showToast('Presupuesto creado: ' + number);
}

async function renderBudgetsList(){
  if(window._mobileFilterOpen) return;
  const list = await GenalDB.getAll('budgets');
  const wrap = document.getElementById('budgets-list'); if(!wrap) return; wrap.innerHTML='';
  if(list.length===0){ wrap.innerHTML='<p class="small">No hay presupuestos.</p>'; return; }
  const numberQuery = (document.getElementById('filter-budget-number')?.value || '').trim().toLowerCase();
  const partQuery = (document.getElementById('filter-budget-part')?.value || '').trim().toLowerCase();
  const clientQuery = (document.getElementById('filter-budget-client')?.value || '').trim().toLowerCase();
  const dateQuery = document.getElementById('filter-budget-date')?.value || '';
  const table = document.createElement('table'); table.className='table';
  table.innerHTML = `<thead><tr><th><input type="checkbox" data-table-select-all aria-label="Seleccionar todos"></th><th>Número</th><th>Parte</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Factura vinculada</th><th>Acciones</th></tr></thead>`;
  const invoices = await GenalDB.getAll('invoices');
  const tbody = document.createElement('tbody');
  let visible = 0;
  const visibleRows = [];
  sortByText(list, item=>item.number, 'budgets');
  for(const b of list){
    const client = await GenalDB.get('clients', b.clientId);
    const part = b.fromPart ? await GenalDB.get('parts', b.fromPart) : null;
    const partNumber = b.partNumber || part?.number || '—';
    const clientName = getClientDisplayName(client);
    const linkedInvoice = invoices.find(invoice=>Number(invoice.fromBudget) === Number(b.id));
    const createdDate = new Date(b.createdAt);
    const dateValue = createdDate.toISOString().slice(0, 10);
    if(numberQuery && !String(b.number || '').toLowerCase().includes(numberQuery)) continue;
    if(partQuery && !String(partNumber).toLowerCase().includes(partQuery)) continue;
    if(clientQuery && !clientName.toLowerCase().includes(clientQuery)) continue;
    if(dateQuery && dateValue !== dateQuery) continue;
    visible++;
    const tr = document.createElement('tr');
    const invoiceInfo = linkedInvoice
      ? `<button class="budget-invoice-link" data-invoice-id="${linkedInvoice.id}">${linkedInvoice.number}</button> · ${fmtCurrency(linkedInvoice.total)} · ${linkedInvoice.issued ? 'Emitida' : 'Pendiente'}`
      : '—';
    const partInfo = b.fromPart
      ? `<button class="budget-part-link" data-part-id="${b.fromPart}">${partNumber}</button>`
      : '—';
    tr.innerHTML = `<td><input type="checkbox" class="row-select" data-row-id="${b.id}" aria-label="Seleccionar ${b.number}"></td><td>${b.number}</td><td>${partInfo}</td><td>${clientName}</td><td>${createdDate.toLocaleString()}</td><td>${fmtCurrency(b.total)}</td><td>${invoiceInfo}</td><td><button class="icon-btn" title="Vista previa" aria-label="Vista previa" data-id="${b.id}" data-action="preview">👁</button> <button class="icon-btn edit-action" title="Modificar" aria-label="Modificar" data-id="${b.id}" data-action="edit">✎</button> <button class="icon-btn pdf-action" title="Descargar PDF" aria-label="Descargar PDF" data-id="${b.id}" data-action="pdf">🖨</button> <button class="icon-btn invoice-action" title="Crear factura" aria-label="Crear factura" data-id="${b.id}" data-action="invoice"><span>$</span></button> <button class="icon-btn danger" title="Eliminar" aria-label="Eliminar" data-id="${b.id}" data-action="del">🗑</button></td>`;
    tr.addEventListener('click', event=>{
      if(event.target.closest('button,input')) return;
      previewBudget(b.id);
    });
    tbody.appendChild(tr);
    visibleRows.push(tr);
  }
  if(visible === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8" class="small">No se encontraron presupuestos.</td>';
    tbody.appendChild(tr);
  }
  table.appendChild(tbody); wrap.appendChild(table);
  const budgetPage = pagedItems(visibleRows, 'budgets');
  visibleRows.forEach(row=>{ if(!budgetPage.items.includes(row)) row.remove(); });
  appendPagination(wrap, 'budgets', visibleRows.length, renderBudgetsList);
  wrap.querySelectorAll('[data-action]').forEach(btn=> btn.addEventListener('click', async event=>{
    event.stopPropagation();
    const id = Number(btn.dataset.id); const action = btn.dataset.action;
      if(action === 'preview') await openRecordPreview('budgets', id);
      else if(action === 'edit') await openBudgetFromBudgetModal(id);
      else if(action === 'pdf') await exportBudgetPDF(id);
      else if(action === 'invoice') await createInvoiceFromBudget(id);
      else if(action === 'del'){
        const budget = await GenalDB.get('budgets', id);
        const linkedInvoice = (await GenalDB.getAll('invoices')).find(invoice=>Number(invoice.fromBudget) === id);
        if(linkedInvoice){ showToast(`No se puede eliminar el presupuesto porque tiene vinculada la factura ${linkedInvoice.number}.`, 'error'); return; }
        if(await showConfirmModal(`¿Eliminar el presupuesto ${budget?.number || ''}?`)){ await GenalDB.remove('budgets', id); renderBudgetsList(); }
      }
    }));
  wrap.querySelectorAll('[data-invoice-id]').forEach(btn=>btn.addEventListener('click', async event=>{
    event.stopPropagation();
    await openRecordPreview('invoices', Number(btn.dataset.invoiceId));
  }));
  wrap.querySelectorAll('[data-part-id]').forEach(btn=>btn.addEventListener('click', async event=>{
    event.stopPropagation();
    await openRecordPreview('parts', Number(btn.dataset.partId));
  }));
  const bulk = document.querySelector('[data-bulk-type="budgets"]');
  if(bulk){
    const selectAll = checked=>wrap.querySelectorAll('.row-select').forEach(input=>input.checked=checked);
    const updateBulkVisibility = setupBulkToolbarVisibility(bulk, wrap);
    bulk.querySelector('[data-select-all]').onchange = event=>{
      selectAll(event.target.checked);
      updateBulkVisibility?.();
    };
    table.querySelector('[data-table-select-all]').onchange = event=>{
      selectAll(event.target.checked);
      updateBulkVisibility?.();
    };
    bulk.querySelector('[data-bulk-action="delete"]').onclick = async ()=>{
      const selectedIds = [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId));
      if(!selectedIds.length) return;
      if(!await showConfirmModal(`¿Eliminar los ${selectedIds.length} presupuestos seleccionados?`)) return;
      let skipped = 0;
      for(const id of selectedIds){
        const linked = (await GenalDB.getAll('invoices')).some(invoice=>Number(invoice.fromBudget)===id);
        if(!linked) await GenalDB.remove('budgets', id);
        else skipped++;
      }
      if(skipped) showToast(`${skipped} presupuesto(s) no se eliminaron porque tienen factura vinculada.`, 'error');
      renderBudgetsList();
    };
    bulk.querySelector('[data-bulk-action="download"]').onclick = async ()=>{
      for(const id of [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId))) await exportBudgetPDF(id);
    };
  }
}

/* Invoices */
function getMissingInvoiceClientFields(client){
  const fields = [
    ['firstName', 'Nombre'],
    ['lastName', 'Apellidos'],
    ['address', 'Dirección'],
    ['locality', 'Localidad'],
    ['postalCode', 'Código postal'],
    ['province', 'Provincia'],
    ['dni', 'DNI / CIF']
  ];
  return fields
    .filter(([key])=>{
      const value = key === 'firstName'
        ? client?.firstName || client?.name
        : key === 'dni'
          ? client?.dni || client?.cif || client?.nif || client?.taxId
          : client?.[key];
      return !String(value || '').trim();
    })
    .map(([,label])=>label);
}

async function validateInvoiceClient(clientId){
  const client = await GenalDB.get('clients', clientId);
  const missingFields = getMissingInvoiceClientFields(client);
  if(missingFields.length){
    showToast(`No se puede crear la factura. Completa los datos del cliente: ${missingFields.join(', ')}.`, 'error');
    return null;
  }
  return client;
}

async function createInvoiceFromBudget(budgetId){
  const budget = await GenalDB.get('budgets', budgetId);
  if(!budget){ showToast('Presupuesto no encontrado', 'error'); return; }
  if(!await validateInvoiceClient(budget.clientId)) return;
  const part = budget.fromPart ? await GenalDB.get('parts', budget.fromPart) : null;
  const invoices = await GenalDB.getAll('invoices');
  const existingInvoice = invoices.find(invoice=>
    Number(invoice.fromBudget) === Number(budgetId)
    || (budget.fromPart && Number(invoice.fromPart) === Number(budget.fromPart))
  );
  if(existingInvoice || (budget.fromPart && part?.invoiced === true)){
    showToast(existingInvoice
      ? `El informe de trabajo ya tiene la factura ${existingInvoice.number}. No se puede crear otra factura para el mismo informe.`
      : 'El informe de trabajo ya está marcado como facturado. No se puede crear otra factura.', 'error');
    return;
  }
  const cfg = await getConfig(); window._lastCfg = cfg;
  const invNumber = `F-${String(cfg.invoice_next||1).padStart(6,'0')}`;
  const invoice = {
    number:invNumber,
    clientId:budget.clientId,
    lines:budget.lines,
    subtotal:budget.subtotal,
    vat_percent:budget.vat_percent,
    vatAmount:budget.vatAmount,
    total:budget.total,
    createdAt:new Date().toISOString(),
    fromBudget:budgetId,
    budgetNumber:budget.number,
    fromPart:budget.fromPart || null,
    partNumber:budget.partNumber || part?.number || '',
    issued:false
  };
  invoice.id = await GenalDB.add('invoices', invoice);
  cfg.invoice_next = (cfg.invoice_next||1) + 1;
  await GenalDB.put('settings', cfg);
  showToast('Factura creada: ' + invNumber);
  renderInvoicesList();
}

// Opens a budget editor from a work report. Piece prices start at zero.
async function openBudgetFromPartModal(partId, budgetId=null){
  const part = partId ? await GenalDB.get('parts', partId) : null;
  const selectedBudget = budgetId ? await GenalDB.get('budgets', budgetId) : null;
  if(part && !budgetId){
    const linkedInvoice = (await GenalDB.getAll('invoices')).find(invoice=>Number(invoice.fromPart) === Number(partId));
    if(linkedInvoice || part.invoiced === true){
      showToast(linkedInvoice
        ? `No se puede crear un presupuesto porque el parte ya tiene la factura ${linkedInvoice.number}.`
        : 'No se puede crear un presupuesto porque el parte ya está facturado.', 'error');
      return;
    }
  }
  if(!part && selectedBudget){
    partId = selectedBudget.fromPart || null;
  }
  const budgetPart = part || (selectedBudget ? {
    clientId: selectedBudget.clientId,
    number: selectedBudget.partNumber || '',
    lines: [],
    customerProblem: selectedBudget.desc || '',
    technicianWork: ''
  } : null);
  if(!budgetPart){ showToast('Parte no encontrado', 'error'); return; }
  const client = await GenalDB.get('clients', budgetPart.clientId);
  const relatedBudgets = (await GenalDB.getAll('budgets'))
    .filter(budget=>budgetId ? Number(budget.id) === Number(budgetId) : Number(budget.fromPart) === Number(partId))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const existingBudget = relatedBudgets[0] || null;
  const originalBudgetLines = existingBudget ? JSON.stringify((existingBudget.lines || []).map(line=>({
    desc: line.desc || line.description || '',
    qty: Number(line.qty) || 0,
    price: Number(line.price) || 0
  }))) : null;
  const device = budgetPart.device || {};
  const lines = [];
  for(const l of (existingBudget?.lines || budgetPart.lines || [])){
    const prod = l.productId ? await GenalDB.get('products', l.productId) : null;
    lines.push({ desc: l.description || l.desc || prod?.name || 'Producto', qty: Number(l.qty) || 0, price: Number(l.price) || 0 });
  }
  if(existingBudget){
    existingBudget.lines.forEach((line, index)=>{ if(lines[index]) lines[index].price = Number(line.price || 0); });
  }
  document.getElementById('part-budget-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'part-budget-modal';
  modal.className = 'modal budget-editor-modal show';
  modal.innerHTML = `
    <div class="budget-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="part-budget-title">
      <div class="budget-editor-header">
        <div>
          <h3 id="part-budget-title">${existingBudget ? `Modificar ${existingBudget.number}` : `Presupuesto desde ${budgetPart.number || 'informe de trabajo'}`}</h3>
              <p class="small">${existingBudget ? 'Presupuesto existente vinculado al parte. Puedes modificar sus precios.' : 'Informe de trabajo y piezas utilizadas. Los precios empiezan en 0,00.'}</p>
        </div>
        <button type="button" class="close-btn" data-budget-action="close" aria-label="Cerrar">×</button>
      </div>
      <div class="budget-report-summary">
        <p><strong>Cliente:</strong> ${getClientDisplayName(client)}</p>
        <p><strong>Dirección:</strong> ${[client?.address, [client?.postalCode, client?.locality, client?.province].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'}</p>
        <p><strong>Equipo:</strong> ${device.brand || '—'} ${device.model || ''} ${device.serialNumber ? `· SN: ${device.serialNumber}` : ''}</p>
        <p><strong>Problema:</strong> ${budgetPart.customerProblem || budgetPart.desc || '—'}</p>
        <p><strong>Trabajo realizado:</strong> ${budgetPart.technicianWork || '—'}</p>
      </div>
      <div class="budget-editor-lines">
        <table class="table">
          <thead><tr><th>Pieza</th><th>Cantidad</th><th>Precio unitario</th><th>Importe</th></tr></thead>
          <tbody id="part-budget-lines"></tbody>
        </table>
      </div>
      <div class="budget-editor-totals" id="part-budget-totals"></div>
      <div class="budget-editor-footer">
        <button type="button" class="btn" data-budget-action="save">Guardar presupuesto</button>
        <button type="button" class="btn secondary" data-budget-action="print">Imprimir</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const cfg = await getConfig();
  const tbody = modal.querySelector('#part-budget-lines');
  lines.forEach((line, index)=>{
    const row = document.createElement('tr');
    row.innerHTML = `<td>${line.desc}</td><td>${line.qty}</td><td><input type="number" min="0" step="0.01" value="${line.price}" data-budget-price="${index}" aria-label="Precio unitario"></td><td data-budget-amount="${index}">0.00</td>`;
    tbody.appendChild(row);
  });
  const updateTotals = ()=>{
    const subtotal = lines.reduce((sum, line, index)=>{
      const input = modal.querySelector(`[data-budget-price="${index}"]`);
      line.price = Math.max(0, Number(input?.value) || 0);
      const amount = line.qty * line.price;
      modal.querySelector(`[data-budget-amount="${index}"]`).textContent = `${amount.toFixed(2)} €`;
      return sum + amount;
    }, 0);
    const vat = Number(cfg.vat_percent || 0);
    const vatAmount = subtotal * vat / 100;
    modal.querySelector('#part-budget-totals').innerHTML = `<strong>Subtotal:</strong> ${subtotal.toFixed(2)} € &nbsp; <strong>IVA ${vat}%:</strong> ${vatAmount.toFixed(2)} € &nbsp; <strong>Total:</strong> ${(subtotal + vatAmount).toFixed(2)} €`;
  };
  modal.querySelectorAll('[data-budget-price]').forEach(input=>input.addEventListener('input', updateTotals));
  updateTotals();
  const close = ()=>modal.remove();
  modal.querySelectorAll('[data-budget-action="close"]').forEach(button=>button.addEventListener('click', close));
  modal.addEventListener('click', event=>{ if(event.target === modal) close(); });
  const persistBudget = async ()=>{
    const subtotal = lines.reduce((sum, line)=>sum + line.qty * line.price, 0);
    const vatAmount = subtotal * (cfg.vat_percent || 0) / 100;
    const number = existingBudget?.number || `P-${String(cfg.budget_next || 1).padStart(6, '0')}`;
    const budgetData = {
      ...(existingBudget || {}),
      number, clientId: budgetPart.clientId, desc: budgetPart.desc || budgetPart.customerProblem || '',
      lines, subtotal, vat_percent: cfg.vat_percent || 0, vatAmount,
      total: subtotal + vatAmount, createdAt: new Date().toISOString(), fromPart: partId, partNumber: budgetPart.number || ''
    };
    const currentBudgetLines = JSON.stringify(lines.map(line=>({
      desc: line.desc || '',
      qty: Number(line.qty) || 0,
      price: Number(line.price) || 0
    })));
    const budgetChanged = !existingBudget || currentBudgetLines !== originalBudgetLines;
    let saveAsNew = !existingBudget;
    if(existingBudget){
      if(!budgetChanged){
        await GenalDB.put('budgets', budgetData);
        return budgetData;
      }
      const choice = await new Promise(resolve=>{
        const choiceModal = document.createElement('div');
        choiceModal.className = 'modal show budget-save-choice-modal';
        choiceModal.innerHTML = `<div class="budget-save-choice-dialog" role="dialog" aria-modal="true">
          <button type="button" class="budget-save-choice-close" aria-label="Salir" title="Salir">×</button>
          <h3>Guardar cambios del presupuesto</h3><p>¿Qué deseas hacer con ${existingBudget.number}?</p>
          <div class="budget-save-choice-actions">
            <button type="button" class="btn" data-choice="update">Guardar presupuesto</button>
            <button type="button" class="btn secondary" data-choice="new">Crear nuevo</button>
          </div></div>`;
        document.body.appendChild(choiceModal);
        const finish = value=>{ choiceModal.remove(); resolve(value); };
        choiceModal.querySelector('[data-choice="update"]').addEventListener('click', ()=>finish('update'));
        choiceModal.querySelector('[data-choice="new"]').addEventListener('click', ()=>finish('new'));
        choiceModal.querySelector('.budget-save-choice-close').addEventListener('click', ()=>finish(null));
        choiceModal.addEventListener('click', event=>{ if(event.target === choiceModal) finish(null); });
      });
      if(!choice) return null;
      saveAsNew = choice === 'new';
    }
    if(saveAsNew){
      delete budgetData.id;
      budgetData.number = `P-${String(cfg.budget_next || 1).padStart(6, '0')}`;
      budgetData.createdAt = new Date().toISOString();
      budgetData.id = await GenalDB.add('budgets', budgetData);
      cfg.budget_next = (cfg.budget_next || 1) + 1;
      await GenalDB.put('settings', cfg);
    }else{
      await GenalDB.put('budgets', budgetData);
    }
    return budgetData;
  };
  modal.querySelector('[data-budget-action="save"]').addEventListener('click', async ()=>{
    const savedBudget = await persistBudget();
    if(!savedBudget) return;
    close();
    renderBudgetsList();
    showToast(savedBudget.number + (existingBudget ? ' actualizado.' : ' creado.'));
  });
  modal.querySelector('[data-budget-action="print"]').addEventListener('click', async ()=>{
    const savedBudget = await persistBudget();
    if(!savedBudget) return;
    close();
    renderBudgetsList();
    await previewBudget(savedBudget.id);
  });
}

async function createBudgetFromPart(partId){
  return openBudgetFromPartModal(partId);
}

function agendaMonthKey(date){
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}`;
}

function agendaDateTimeLabel(value){
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});
}

async function syncAppointmentsForPart(part){
  const appointments = await GenalDB.getAll('appointments');
  const related = appointments.filter(item=>Number(item.partId) === Number(part.id));
  const isPendingVisit = isAgendaAppointmentStatus(part.status);
  for(const appointment of related){
    const nextStatus = isPendingVisit ? 'Pendiente' : 'Finalizada';
    if(appointment.status !== nextStatus){
      appointment.status = nextStatus;
      await GenalDB.put('appointments', appointment);
    }
  }
}

function isAgendaAppointmentStatus(status){
  const normalized = String(status || '').trim().toLocaleLowerCase();
  return normalized === 'pte visitar' || normalized === 'segunda visita';
}

function agendaDateTimeInputValue(value){
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0,16);
}

function agendaTimeOptions(selectedTime){
  const options = [];
  for(let hour = 0; hour < 24; hour++){
    for(let minutes = 0; minutes < 60; minutes += 15){
      const value = `${String(hour).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
      options.push(`<option value="${value}" ${value === selectedTime ? 'selected' : ''}>${value}</option>`);
    }
  }
  return options.join('');
}

async function renderAgendaView(container){
  const now = new Date();
  const selectedKey = window._agendaMonth || agendaMonthKey(now);
  const [year, month] = selectedKey.split('-').map(Number);
  const monthDate = new Date(year, month - 1, 1);
  const appointments = await GenalDB.getAll('appointments');
  const parts = await GenalDB.getAll('parts');
  const clients = await GenalDB.getAll('clients');
  const partsById = new Map(parts.map(part=>[Number(part.id), part]));
  const clientsById = new Map(clients.map(client=>[Number(client.id), client]));
  for(const appointment of appointments){
    const part = partsById.get(Number(appointment.partId));
    if(part) await syncAppointmentsForPart(part);
  }
  const refreshedAppointments = await GenalDB.getAll('appointments');
  appointments.splice(0, appointments.length, ...refreshedAppointments);
  const monthAppointments = appointments
    .filter(item=>agendaMonthKey(new Date(item.dateTime)) === selectedKey)
    .sort((a,b)=>new Date(a.dateTime)-new Date(b.dateTime));
  const firstDay = new Date(year, month - 1, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const calendarCells = [];
  for(let i=0;i<offset;i++) calendarCells.push('<div class="agenda-day agenda-day-empty"></div>');
  for(let day=1;day<=daysInMonth;day++){
    const dayItems = monthAppointments.filter(item=>new Date(item.dateTime).getDate() === day);
    calendarCells.push(`<div class="agenda-day" data-agenda-day="${day}"><strong>${day}</strong>${dayItems.map(item=>{
      const part = partsById.get(Number(item.partId));
      return `<button type="button" draggable="true" class="agenda-event${item.status === 'Finalizada' ? ' agenda-event-finished' : ''}" data-agenda-id="${item.id}">${new Date(item.dateTime).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})} · ${part?.number || 'Informe'}${item.status === 'Finalizada' ? ' · Finalizada' : ''}</button>`;
    }).join('')}</div>`);
  }
  const editingAppointment = window._agendaEditingId
    ? appointments.find(item=>Number(item.id) === Number(window._agendaEditingId))
    : null;
  const partsWithPendingAppointments = new Set(
    appointments
      .filter(item=>item.status !== 'Finalizada' && Number(item.id) !== Number(editingAppointment?.id))
      .map(item=>Number(item.partId))
  );
  const eligibleParts = parts.filter(part=>
    (isAgendaAppointmentStatus(part.status) && !partsWithPendingAppointments.has(Number(part.id)))
    || Number(part.id) === Number(editingAppointment?.partId)
  );
  const editingPart = parts.find(part=>Number(part.id) === Number(editingAppointment?.partId));
  if(editingPart && !eligibleParts.some(part=>Number(part.id) === Number(editingPart.id))){
    eligibleParts.push(editingPart);
  }
  if(editingAppointment && !eligibleParts.some(part=>Number(part.id) === Number(editingAppointment.partId))){
    eligibleParts.push({
      id: editingAppointment.partId,
      number: editingAppointment.partNumber || 'Informe',
      clientId: editingAppointment.clientId
    });
  }
  const partOptions = eligibleParts
    .slice().sort((a,b)=>String(a.number || '').localeCompare(String(b.number || ''),'es',{numeric:true}))
    .map(part=>`<option value="${part.id}" ${Number(part.id) === Number(editingAppointment?.partId) ? 'selected' : ''}>${part.number || 'Informe'} · ${getClientDisplayName(clientsById.get(Number(part.clientId)))}${!isAgendaAppointmentStatus(part.status) ? ' · estado actual' : ''}</option>`).join('');
  const card = document.createElement('div');
  card.className = 'card agenda-view';
  card.innerHTML = `
    <div class="agenda-header">
      <div><h2>Agenda</h2><p class="small">Citas vinculadas a informes de trabajo.</p></div>
      <div class="agenda-month-nav">
        <button type="button" class="btn secondary" data-agenda-month="-1">‹</button>
        <strong>${monthDate.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</strong>
        <button type="button" class="btn secondary" data-agenda-month="1">›</button>
      </div>
    </div>
    <form class="agenda-form" id="agenda-form">
      <label>Informe de trabajo<select id="agenda-part" required><option value="">Selecciona un informe</option>${partOptions}</select></label>
      <label>Fecha y hora<input id="agenda-date-time" type="datetime-local" required value="${editingAppointment ? agendaDateTimeInputValue(editingAppointment.dateTime) : ''}"></label>
      <label>Notas<input id="agenda-notes" type="text" maxlength="300" placeholder="Motivo o notas de la cita" value="${editingAppointment?.notes || ''}"></label>
      <button type="submit" class="btn">${editingAppointment ? 'Guardar cambios' : 'Añadir cita'}</button>
    </form>
    <div class="agenda-weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
    <div class="agenda-calendar">${calendarCells.join('')}</div>
    <h3>Citas del mes</h3>
    <div class="agenda-list">${monthAppointments.length ? monthAppointments.map(item=>{
      const part = partsById.get(Number(item.partId));
      const client = part ? clientsById.get(Number(part.clientId)) : null;
      return `<div class="agenda-list-item"><div><strong>${agendaDateTimeLabel(item.dateTime)}</strong> · <button type="button" class="link-button" data-open-part="${part?.id || ''}">${part?.number || 'Informe eliminado'}</button> · ${getClientDisplayName(client)}${item.status === 'Finalizada' ? ' · <strong>Finalizada</strong>' : ''}${item.notes ? `<br><span class="small">${item.notes}</span>` : ''}</div><div><button type="button" class="icon-btn edit-action" title="Modificar cita" aria-label="Modificar cita" data-edit-agenda="${item.id}">✎</button> <button type="button" class="icon-btn danger" title="Eliminar cita" aria-label="Eliminar cita" data-delete-agenda="${item.id}">🗑</button></div></div>`;
    }).join('') : '<p class="small">No hay citas para este mes.</p>'}</div>`;
  container.appendChild(card);
  card.querySelectorAll('[data-agenda-month]').forEach(button=>button.addEventListener('click', ()=>{
    const next = new Date(year, month - 1 + Number(button.dataset.agendaMonth), 1);
    window._agendaMonth = agendaMonthKey(next);
    showView('agenda');
  }));
  card.querySelectorAll('[data-agenda-day]').forEach(dayCell=>{
    dayCell.addEventListener('dragover', event=>{
      event.preventDefault();
      dayCell.classList.add('agenda-day-drop-target');
    });
    dayCell.addEventListener('dragleave', ()=>dayCell.classList.remove('agenda-day-drop-target'));
    dayCell.addEventListener('drop', async event=>{
      event.preventDefault();
      dayCell.classList.remove('agenda-day-drop-target');
      const appointmentId = Number(event.dataTransfer.getData('text/plain'));
      const appointment = appointments.find(item=>Number(item.id) === appointmentId);
      if(!appointment) return;
      const sourceDate = new Date(appointment.dateTime);
      const movedDate = new Date(year, month - 1, Number(dayCell.dataset.agendaDay), sourceDate.getHours(), sourceDate.getMinutes(), 0, 0);
      if(!await confirmAppointmentConflict(appointments, movedDate.toISOString(), appointment.id)) return;
      appointment.dateTime = movedDate.toISOString();
      await GenalDB.put('appointments', appointment);
      showToast('Cita movida al ' + movedDate.toLocaleDateString('es-ES') + '.');
      await showView('agenda');
    });
  });
  card.querySelector('#agenda-form').addEventListener('submit', async event=>{
    event.preventDefault();
    const partId = Number(card.querySelector('#agenda-part').value);
    const dateTime = card.querySelector('#agenda-date-time').value;
    if(!partId || !dateTime){ showToast('Selecciona un informe y una fecha para la cita.', 'error'); return; }
    const selectedPart = partsById.get(partId);
    const hasPendingAppointment = appointments.some(item =>
      Number(item.partId) === partId &&
      item.status !== 'Finalizada' &&
      Number(item.id) !== Number(editingAppointment?.id)
    );
    if(hasPendingAppointment){
      showToast('Ese informe ya tiene una cita pendiente. Finaliza o modifica la cita existente antes de añadir otra.', 'error');
      return;
    }
    if(!selectedPart || (!isAgendaAppointmentStatus(selectedPart.status) && !editingAppointment)){
      showToast('Solo se pueden crear citas para informes con estado "Pte visitar" o "Segunda visita".', 'error');
      return;
    }
    const appointmentData = {
      ...(editingAppointment || {}),
      partId,
      dateTime:new Date(dateTime).toISOString(),
      notes:card.querySelector('#agenda-notes').value.trim(),
      status: isAgendaAppointmentStatus(selectedPart.status) ? 'Pendiente' : 'Finalizada',
      createdAt:editingAppointment?.createdAt || new Date().toISOString()
    };
    if(!await confirmAppointmentConflict(appointments, appointmentData.dateTime, editingAppointment?.id)) return;
    if(editingAppointment) await GenalDB.put('appointments', appointmentData);
    else await GenalDB.add('appointments', appointmentData);
    window._agendaEditingId = null;
    showToast(editingAppointment ? 'Cita modificada.' : 'Cita añadida.');
    window._agendaMonth = agendaMonthKey(new Date(dateTime));
    showView('agenda');
  });
  card.querySelectorAll('[data-edit-agenda]').forEach(button=>button.addEventListener('click', ()=>{
    window._agendaEditingId = Number(button.dataset.editAgenda);
    showView('agenda');
  }));
  card.querySelectorAll('[data-delete-agenda]').forEach(button=>button.addEventListener('click', async ()=>{
    if(await showConfirmModal('¿Eliminar esta cita?')){
      await GenalDB.remove('appointments', Number(button.dataset.deleteAgenda));
      window._agendaEditingId = null;
      showView('agenda');
    }
  }));
  card.querySelectorAll('[data-open-part]').forEach(button=>button.addEventListener('click', async ()=>{
    if(!button.dataset.openPart) return;
    await openPartDetailsModal(Number(button.dataset.openPart));
  }));
  card.querySelectorAll('[data-agenda-id]').forEach(button=>{
    button.addEventListener('dragstart', event=>{
      window._agendaDragging = true;
      event.dataTransfer.setData('text/plain', button.dataset.agendaId);
      event.dataTransfer.effectAllowed = 'move';
      button.classList.add('agenda-event-dragging');
    });
    button.addEventListener('dragend', ()=>{
      button.classList.remove('agenda-event-dragging');
      setTimeout(()=>{ window._agendaDragging = false; }, 0);
    });
    button.addEventListener('click', async event=>{
      if(window._agendaDragging) return;
      event.stopPropagation();
      const appointment = appointments.find(item=>Number(item.id) === Number(button.dataset.agendaId));
      if(!appointment) return;
      document.querySelector('.agenda-time-popover')?.remove();
      const appointmentDate = new Date(appointment.dateTime);
      const currentTime = `${String(appointmentDate.getHours()).padStart(2,'0')}:${String(appointmentDate.getMinutes()).padStart(2,'0')}`;
      const popover = document.createElement('div');
      popover.className = 'agenda-time-popover';
      popover.setAttribute('role', 'dialog');
      popover.setAttribute('aria-label', 'Cambiar hora de la cita');
      popover.innerHTML = `
        <strong>Cambiar hora</strong>
        <select class="agenda-time-select" aria-label="Nueva hora">${agendaTimeOptions(currentTime)}</select>
        <div class="agenda-time-actions">
          <button type="button" class="btn" data-save-agenda-time>Guardar</button>
          <button type="button" class="btn secondary" data-cancel-agenda-time>Cancelar</button>
        </div>
        <button type="button" class="btn agenda-time-delete" data-delete-agenda-time>Eliminar cita</button>`;
      document.body.appendChild(popover);
      const buttonRect = button.getBoundingClientRect();
      const popoverWidth = 190;
      if(window.innerWidth <= 600){
        popover.classList.add('agenda-time-popover-centered');
      }else{
        const left = Math.min(Math.max(8, buttonRect.left), window.innerWidth - popoverWidth - 8);
        const top = buttonRect.bottom + 6 + 150 > window.innerHeight && buttonRect.top > 150
          ? buttonRect.top - 156
          : buttonRect.bottom + 6;
        popover.style.left = `${left}px`;
        popover.style.top = `${Math.max(8, top)}px`;
      }
      popover.querySelector('.agenda-time-select').focus();
      const closePopover = ()=>popover.remove();
      popover.querySelector('[data-cancel-agenda-time]').addEventListener('click', closePopover);
      popover.querySelector('[data-delete-agenda-time]').addEventListener('click', async ()=>{
        if(!await showConfirmModal('¿Eliminar esta cita?')) return;
        await GenalDB.remove('appointments', Number(appointment.id));
        closePopover();
        showToast('Cita eliminada.');
        await showView('agenda');
      });
      popover.querySelector('[data-save-agenda-time]').addEventListener('click', async ()=>{
        const [hours, minutes] = popover.querySelector('.agenda-time-select').value.split(':').map(Number);
        const updatedDate = new Date(appointmentDate);
        updatedDate.setHours(hours, minutes, 0, 0);
        if(!await confirmAppointmentConflict(appointments, updatedDate.toISOString(), appointment.id)) return;
        appointment.dateTime = updatedDate.toISOString();
        await GenalDB.put('appointments', appointment);
        closePopover();
        showToast('Hora de la cita actualizada.');
        await showView('agenda');
      });
      const outsideClick = outsideEvent=>{
        if(!popover.contains(outsideEvent.target) && outsideEvent.target !== button){
          closePopover();
          document.removeEventListener('click', outsideClick);
        }
      };
      setTimeout(()=>document.addEventListener('click', outsideClick), 0);
    });
  });
}

async function openBudgetFromBudgetModal(budgetId){
  return openBudgetFromPartModal(null, budgetId);
}

// Create an invoice from a part without changing inventory.
async function chooseBudgetForInvoice(partId, budgets){
  if(budgets.length === 1) return budgets[0];
  const modal = document.createElement('div');
  modal.className = 'modal show budget-save-choice-modal';
  modal.innerHTML = `<div class="budget-save-choice-dialog budget-invoice-choice-dialog" role="dialog" aria-modal="true">
    <button type="button" class="budget-save-choice-close" aria-label="Cerrar" title="Cerrar">×</button>
    <h3>Elegir presupuesto</h3>
    <p>Este parte tiene varios presupuestos. Selecciona el que quieres utilizar para crear la factura.</p>
    <div class="budget-invoice-choice-list"></div>
  </div>`;
  document.body.appendChild(modal);
  const list = modal.querySelector('.budget-invoice-choice-list');
  budgets.forEach(budget=>{
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn budget-invoice-choice';
    button.innerHTML = `<strong>${budget.number}</strong> · ${new Date(budget.createdAt).toLocaleString()} · ${fmtCurrency(budget.total)}`;
    list.appendChild(button);
  });
  return new Promise(resolve=>{
    const finish = value=>{ modal.remove(); resolve(value); };
    modal.querySelector('.budget-save-choice-close').addEventListener('click', ()=>finish(null));
    modal.addEventListener('click', event=>{ if(event.target === modal) finish(null); });
    modal.querySelectorAll('.budget-invoice-choice').forEach((button,index)=>{
      button.addEventListener('click', ()=>finish(budgets[index]));
    });
  });
  appendPagination(wrap, 'parts', sortedParts.length, renderPartsList);
}

async function createInvoiceFromPart(partId){
  const part = await GenalDB.get('parts', partId);
  if(!part){ showToast('Parte no encontrado', 'error'); return; }
  if(!await validateInvoiceClient(part.clientId)) return;
  const invoices = await GenalDB.getAll('invoices');
  const existingInvoice = invoices.find(invoice=>Number(invoice.fromPart) === Number(partId));
  if(existingInvoice || part.invoiced === true){
    showToast(existingInvoice
      ? `Este informe de trabajo ya tiene la factura ${existingInvoice.number}. No se puede crear otra factura para el mismo informe.`
      : 'Este informe de trabajo ya está marcado como facturado. No se puede crear otra factura.', 'error');
    return;
  }
  const budgets = await GenalDB.getAll('budgets');
  const linkedBudgets = budgets
    .filter(budget=>Number(budget.fromPart) === Number(partId))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(linkedBudgets.length === 0){
    showToast('No se puede crear la factura: este informe de trabajo no tiene un presupuesto previo. Crea y guarda primero el presupuesto.', 'error');
    return;
  }
  const linkedBudget = await chooseBudgetForInvoice(partId, linkedBudgets);
  if(!linkedBudget) return;
  const cfg = await getConfig();
  const clientId = part.clientId;
  const lines = (linkedBudget.lines || []).map(line=>({
    desc: line.desc || line.description || 'Concepto',
    qty: Number(line.qty) || 0,
    price: Number(line.price) || 0
  }));
  const subtotal = lines.reduce((s,x)=> s + x.qty*x.price, 0);
  const vatAmount = subtotal * (cfg.vat_percent||0) / 100;
  const total = subtotal + vatAmount;
  const invoiceData = {
    clientId, lines, subtotal, vat_percent:cfg.vat_percent||0, vatAmount, total,
    fromPart:partId,
    partNumber:part.number || '',
    fromBudget:linkedBudget.id,
    budgetNumber:linkedBudget.number || '',
    issued:false
  };
  const created = await createInvoice(invoiceData);
  if(!created) return;
  // link invoice to part, client and the selected budget
  await GenalDB.put('invoices', created);
  // mark part as invoiced
  part.invoiced = true; await GenalDB.put('parts', part);
  showToast('Factura creada desde parte: ' + created.number);
  renderInvoicesList();
}

async function renderInvoicesList(){
  if(window._mobileFilterOpen) return;
  const renderToken = (window._invoiceRenderToken || 0) + 1;
  window._invoiceRenderToken = renderToken;
  const list = await GenalDB.getAll('invoices');
  if(renderToken !== window._invoiceRenderToken) return;
  const wrap = document.getElementById('invoices-list'); if(!wrap) return; wrap.innerHTML='';
  const numberQuery = (document.getElementById('filter-invoice-number')?.value || '').trim().toLowerCase();
  const clientQuery = (document.getElementById('filter-invoice-client')?.value || '').trim().toLowerCase();
  const dateMode = document.getElementById('filter-invoice-date-mode')?.value || 'single';
  const dateQuery = document.getElementById('filter-invoice-date')?.value || '';
  const dateFrom = document.getElementById('filter-invoice-date-from')?.value || '';
  const dateTo = document.getElementById('filter-invoice-date-to')?.value || '';
  const table = document.createElement('table'); table.className='table';
  table.innerHTML = `<thead><tr><th><input type="checkbox" data-table-select-all aria-label="Seleccionar todas"></th><th>Número</th><th>Presupuesto</th><th>Parte</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Acciones</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  let visible = 0;
  const visibleRows = [];
  sortByText(list, item=>item.number, 'invoices');
  for(const inv of list){
    const client = await GenalDB.get('clients', inv.clientId);
    if(renderToken !== window._invoiceRenderToken) return;
    const clientName = getClientDisplayName(client);
    const createdDate = new Date(inv.createdAt);
    if(numberQuery && !String(inv.number || '').toLowerCase().includes(numberQuery)) continue;
    if(clientQuery && !clientName.toLowerCase().includes(clientQuery)) continue;
    const invoiceDate = createdDate.toISOString().slice(0,10);
    if(dateMode === 'single' && dateQuery && invoiceDate !== dateQuery) continue;
    if(dateMode === 'range' && ((dateFrom && invoiceDate < dateFrom) || (dateTo && invoiceDate > dateTo))) continue;
    visible++;
    const tr = document.createElement('tr');
    const issuedLabel = inv.issued ? 'Emitida' : 'Marcar emitida';
    const issuedClass = inv.issued ? 'invoice-issued' : 'invoice-pending';
    const budgetInfo = inv.fromBudget
      ? `<button class="invoice-budget-link" data-budget-id="${inv.fromBudget}">${inv.budgetNumber || 'Presupuesto'}</button>`
      : '—';
    const partInfo = inv.fromPart && inv.partNumber
      ? `<button class="invoice-budget-link" data-part-id="${inv.fromPart}">${inv.partNumber}</button>`
      : '—';
    const paidLabel = inv.paid ? 'Cobrada' : 'Marcar cobrada';
    const paidClass = inv.paid ? 'invoice-paid' : 'invoice-unpaid';
    const protectedInvoice = inv.issued || inv.paid;
    const protectedReason = inv.issued && inv.paid
      ? 'Factura emitida y cobrada: no eliminable'
      : inv.issued
        ? 'Factura emitida: no eliminable'
        : 'Factura cobrada: no eliminable';
    tr.innerHTML = `<td><input type="checkbox" class="row-select" data-row-id="${inv.id}" aria-label="Seleccionar ${inv.number}"></td><td>${inv.number}</td><td>${budgetInfo}</td><td>${partInfo}</td><td>${clientName}</td><td>${createdDate.toLocaleString()}</td><td>${fmtCurrency(inv.total)}</td><td><button class="icon-btn" title="Vista previa" aria-label="Vista previa" data-id="${inv.id}" data-action="preview">👁</button> <button class="btn invoice-status ${issuedClass}" title="${inv.issued ? 'Desmarcar emitida' : 'Marcar factura como emitida'}" data-id="${inv.id}" data-action="issued">${issuedLabel}</button> <button class="btn invoice-status ${paidClass}" title="${inv.paid ? 'Marcar factura como pendiente de cobro' : 'Marcar factura como cobrada'}" data-id="${inv.id}" data-action="paid">${paidLabel}</button> <button class="icon-btn pdf-action" title="Descargar PDF" aria-label="Descargar PDF" data-id="${inv.id}" data-action="pdf">🖨</button> <button class="icon-btn danger" title="${protectedInvoice ? protectedReason : 'Eliminar'}" aria-label="${protectedInvoice ? protectedReason : 'Eliminar'}" data-id="${inv.id}" data-action="del" ${protectedInvoice ? 'disabled' : ''}>🗑</button></td>`;
    tbody.appendChild(tr);
    visibleRows.push(tr);
    tr.addEventListener('click', event=>{
      if(event.target.closest('button, input, select, textarea, a')) return;
      previewInvoice(inv.id);
    });
  }
  if(visible === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" class="small">${list.length ? 'No se encontraron facturas.' : 'No hay facturas.'}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody); wrap.appendChild(table);
  const invoicePage = pagedItems(visibleRows, 'invoices');
  visibleRows.forEach(row=>{ if(!invoicePage.items.includes(row)) row.remove(); });
  appendPagination(wrap, 'invoices', visibleRows.length, renderInvoicesList);
  wrap.querySelectorAll('[data-action]').forEach(btn=> btn.addEventListener('click', async ()=>{
    const id = Number(btn.dataset.id); const action = btn.dataset.action;
      if(action === 'preview') await openRecordPreview('invoices', id);
      else if(action === 'issued'){
        const invoice = await GenalDB.get('invoices', id);
        if(invoice){
          if(invoice.issued && !await showConfirmModal(`¿Quieres desmarcar como emitida la factura ${invoice.number || ''}?`, 'Desmarcar emitida')) return;
          invoice.issued = !invoice.issued;
          await GenalDB.put('invoices', invoice);
          renderInvoicesList();
        }
      }
      else if(action === 'paid'){
        const invoice = await GenalDB.get('invoices', id);
        if(invoice){
          if(invoice.paid && !await showConfirmModal(`¿Quieres desmarcar como cobrada la factura ${invoice.number || ''}?`, 'Desmarcar cobrada')) return;
          invoice.paid = !invoice.paid;
          await GenalDB.put('invoices', invoice);
          renderInvoicesList();
        }
      }
      else if(action === 'pdf') await exportInvoicePDF(id);
      else if(action === 'del'){
        const invoice = await GenalDB.get('invoices', id);
        if(invoice?.issued || invoice?.paid){
          showToast(invoice.issued && invoice.paid
            ? 'La factura está emitida y cobrada y no se puede eliminar.'
            : invoice.issued
              ? 'La factura está emitida y no se puede eliminar.'
              : 'La factura está cobrada y no se puede eliminar.', 'error');
          return;
        }
        if(await showConfirmModal(`¿Eliminar la factura ${invoice?.number || ''}?`)){
          await GenalDB.remove('invoices', id);
          if(invoice?.fromPart){
            const remaining = (await GenalDB.getAll('invoices')).some(item=>Number(item.fromPart) === Number(invoice.fromPart));
            if(!remaining){
              const part = await GenalDB.get('parts', invoice.fromPart);
              if(part){ part.invoiced = false; await GenalDB.put('parts', part); }
            }
          }
          renderInvoicesList();
        }
      }
    }));
  wrap.querySelectorAll('[data-budget-id]').forEach(btn=>btn.addEventListener('click', async event=>{
    event.stopPropagation();
    await openRecordPreview('budgets', Number(btn.dataset.budgetId));
  }));
  wrap.querySelectorAll('[data-part-id]').forEach(btn=>btn.addEventListener('click', async event=>{
    event.stopPropagation();
    await openRecordPreview('parts', Number(btn.dataset.partId));
  }));
  const bulk = document.querySelector('[data-bulk-type="invoices"]');
  if(bulk){
    const selectAll = checked=>wrap.querySelectorAll('.row-select').forEach(input=>input.checked=checked);
    const updateBulkVisibility = setupBulkToolbarVisibility(bulk, wrap);
    bulk.querySelector('[data-select-all]').onchange = event=>{
      selectAll(event.target.checked);
      updateBulkVisibility?.();
    };
    table.querySelector('[data-table-select-all]').onchange = event=>{
      selectAll(event.target.checked);
      updateBulkVisibility?.();
    };
    bulk.querySelector('[data-bulk-action="delete"]').onclick = async ()=>{
      const selectedIds = [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId));
      if(!selectedIds.length) return;
      if(!await showConfirmModal(`¿Eliminar las ${selectedIds.length} facturas seleccionadas?`)) return;
      let skipped = 0;
      for(const id of selectedIds){
        const invoice = await GenalDB.get('invoices', id);
        if(invoice && !invoice.issued && !invoice.paid){
          await GenalDB.remove('invoices', id);
          if(invoice.fromPart){
            const remaining = (await GenalDB.getAll('invoices')).some(item=>Number(item.fromPart) === Number(invoice.fromPart));
            if(!remaining){
              const part = await GenalDB.get('parts', invoice.fromPart);
              if(part){ part.invoiced = false; await GenalDB.put('parts', part); }
            }
          }
        } else skipped++;
      }
      if(skipped) showToast(`${skipped} factura(s) emitidas o cobradas no se eliminaron.`, 'error');
      renderInvoicesList();
    };
    bulk.querySelector('[data-bulk-action="download"]').onclick = async ()=>{
      for(const id of [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId))) await exportInvoicePDF(id);
    };
    bulk.querySelector('[data-bulk-action="issue"]').onclick = async ()=>{
      for(const id of [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId))){
        const invoice = await GenalDB.get('invoices', id);
        if(invoice){ invoice.issued = true; await GenalDB.put('invoices', invoice); }
      }
      renderInvoicesList();
    };
    bulk.querySelector('[data-bulk-action="paid"]').onclick = async ()=>{
      for(const id of [...wrap.querySelectorAll('.row-select:checked')].map(input=>Number(input.dataset.rowId))){
        const invoice = await GenalDB.get('invoices', id);
        if(invoice){ invoice.paid = true; await GenalDB.put('invoices', invoice); }
      }
      renderInvoicesList();
    };
  }
}

async function createInvoice(invoiceData){
  if(!await validateInvoiceClient(invoiceData.clientId)) return null;
  const cfg = await getConfig(); window._lastCfg = cfg;
  const invNumber = `F-${String(cfg.invoice_next||1).padStart(6,'0')}`;
  invoiceData.number = invNumber;
  invoiceData.createdAt = new Date().toISOString();
  invoiceData.paid = Boolean(invoiceData.paid);
  const id = await GenalDB.add('invoices', invoiceData);
  invoiceData.id = id;
  cfg.invoice_next = (cfg.invoice_next||1) + 1;
  await GenalDB.put('settings', cfg);
  renderInvoicesList();
  return invoiceData;
}

async function exportInvoicePDF(invoiceId){
  const inv = await GenalDB.get('invoices', invoiceId);
  if(!inv){ showToast('Factura no encontrada', 'error'); return; }
  const client = await GenalDB.get('clients', inv.clientId);
  const cfg = await getConfig(); window._lastCfg = cfg;
  // build a simple invoice HTML with company header and logo
  const company = cfg.company || {};
  const logoSrc = cfg.logo || window._pendingLogoDataUrl || '';
  let html = documentStart();
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">`;
  if(logoSrc){ html += `<div style="flex:0 0 160px"><img src=\"${logoSrc}\" alt=\"logo\" style=\"max-height:80px;max-width:160px;object-fit:contain\"></div>`; }
  html += `<div style="flex:1;text-align:right">`;
  html += `<strong>${company.name||'Mi Empresa'}</strong><br>`;
  // address lines: street, postal/city/province
  const addrPartsInv = [];
  if(company.address) addrPartsInv.push(company.address);
  const locInv = [company.postal, company.city, company.province].filter(Boolean).join(' ');
  if(locInv) addrPartsInv.push(locInv);
  if(addrPartsInv.length) html += addrPartsInv.join('<br>') + '<br>';
  if(company.tax) html += `CIF/NIF: ${company.tax}<br>`;
  if(company.phone) html += `Tel: ${company.phone} `;
  if(company.email) html += `${company.email}<br>`;
  html += `</div></div>`;
  html += `<h3 style=\"margin:8px 0\">Factura ${inv.number}</h3>`;
  html += `<p><strong>Cliente:</strong> ${getClientDisplayName(client)}<br>
    <strong>Dirección:</strong> ${client?.address || '—'}<br>
    <strong>Localidad:</strong> ${client?.locality || '—'}<br>
    <strong>Provincia:</strong> ${client?.province || '—'}<br>
    <strong>Código postal:</strong> ${client?.postalCode || '—'}<br>
    <strong>DNI / NIF:</strong> ${client?.dni || '—'}<br>
    <strong>Teléfono:</strong> ${client?.phone || client?.contact || '—'}${client?.email ? `<br><strong>Email:</strong> ${client.email}` : ''}</p>`;
  html += `<p><strong>Fecha:</strong> ${new Date(inv.createdAt).toLocaleString()}</p>`;
  html += `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;border-bottom:1px solid #ccc">Descripción</th><th style="border-bottom:1px solid #ccc">Cant.</th><th style="border-bottom:1px solid #ccc">P.Unit</th><th style="border-bottom:1px solid #ccc">Total</th></tr></thead><tbody>`;
  for(const l of inv.lines){ html += `<tr><td style="padding:6px 0">${l.desc||''}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">${Number(l.price||0).toFixed(2)}</td><td style="text-align:right">${Number(l.qty*l.price||0).toFixed(2)}</td></tr>`; }
  html += `</tbody></table>`;
  html += `<p style="text-align:right"><strong>Subtotal:</strong> ${Number(inv.subtotal||0).toFixed(2)} ${cfg.currency} <br><strong>IVA ${inv.vat_percent}%:</strong> ${Number(inv.vatAmount||0).toFixed(2)} ${cfg.currency} <br><strong>Total:</strong> ${Number(inv.total||0).toFixed(2)} ${cfg.currency}</p>`;
  html += `</div>`;
  // use html2pdf
  const opt = { margin: 10, filename: `${inv.number}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
  const el = document.createElement('div'); el.innerHTML = html; document.body.appendChild(el);
  try{ await html2pdf().from(el).set(opt).save(); }catch(err){ showToast('Error generando PDF', 'error'); }
  el.remove();
}

async function exportBudgetPDF(budgetId){
  const b = await GenalDB.get('budgets', budgetId);
  if(!b){ showToast('Presupuesto no encontrado', 'error'); return; }
  const client = await GenalDB.get('clients', b.clientId);
  const sourcePart = b.fromPart ? await GenalDB.get('parts', b.fromPart) : null;
  const cfg = await getConfig(); window._lastCfg = cfg;
  const company = cfg.company || {};
  const logoSrc = cfg.logo || window._pendingLogoDataUrl || '';
  let html = documentStart();
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">`;
  if(logoSrc){ html += `<div style="flex:0 0 160px"><img src=\"${logoSrc}\" alt=\"logo\" style=\"max-height:80px;max-width:160px;object-fit:contain\"></div>`; }
  html += `<div style="flex:1;text-align:right">`;
  html += `<strong>${company.name||'Mi Empresa'}</strong><br>`;
  // address lines: street, postal/city/province
  const addrPartsBud = [];
  if(company.address) addrPartsBud.push(company.address);
  const locBud = [company.postal, company.city, company.province].filter(Boolean).join(' ');
  if(locBud) addrPartsBud.push(locBud);
  if(addrPartsBud.length) html += addrPartsBud.join('<br>') + '<br>';
  if(company.tax) html += `CIF/NIF: ${company.tax}<br>`;
  if(company.phone) html += `Tel: ${company.phone} `;
  if(company.email) html += `${company.email}<br>`;
  html += `</div></div>`;
  html += `<h3 style=\"margin:8px 0\">Presupuesto ${b.number}</h3>`;
  const clientAddress = [
    client?.address,
    [client?.postalCode, client?.locality, client?.province].filter(Boolean).join(' ')
  ].filter(Boolean);
  html += `<p><strong>Cliente:</strong> ${getClientDisplayName(client)}<br>
    <strong>Dirección:</strong> ${client?.address || '—'}<br>
    <strong>Localidad:</strong> ${client?.locality || '—'}<br>
    <strong>Provincia:</strong> ${client?.province || '—'}<br>
    <strong>Código postal:</strong> ${client?.postalCode || '—'}</p>`;
  html += `<p><strong>Fecha:</strong> ${new Date(b.createdAt).toLocaleString()}</p>`;
  if(sourcePart?.technicianWork) html += `<h3>Trabajos realizados</h3><p style="white-space:pre-wrap">${sourcePart.technicianWork}</p>`;
  html += `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;border-bottom:1px solid #ccc">Descripción</th><th style="border-bottom:1px solid #ccc">Cant.</th><th style="border-bottom:1px solid #ccc">P.Unit</th><th style="border-bottom:1px solid #ccc">Total</th></tr></thead><tbody>`;
  for(const l of b.lines){ html += `<tr><td style="padding:6px 0">${l.desc||''}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">${Number(l.price||0).toFixed(2)}</td><td style="text-align:right">${Number(l.qty*l.price||0).toFixed(2)}</td></tr>`; }
  html += `</tbody></table>`;
  html += `<p style="text-align:right"><strong>Subtotal:</strong> ${Number(b.subtotal||0).toFixed(2)} ${cfg.currency} <br><strong>IVA ${b.vat_percent}%:</strong> ${Number(b.vatAmount||0).toFixed(2)} ${cfg.currency} <br><strong>Total:</strong> ${Number(b.total||0).toFixed(2)} ${cfg.currency}</p>`;
  html += `</div>`;
  const opt = { margin: 10, filename: `${b.number}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
  const el = document.createElement('div'); el.innerHTML = html; document.body.appendChild(el);
  try{ await html2pdf().from(el).set(opt).save(); }catch(err){ showToast('Error generando PDF', 'error'); }
  el.remove();
}

// Preview modal and helpers
function showPreview(html, filename, actions=[]){
  let modal = document.getElementById('preview-modal');
  if(!modal){
    modal = document.createElement('div'); modal.id='preview-modal'; modal.className='modal';
    modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3>Vista previa</h3><button id="preview-close" class="close-btn" aria-label="Cerrar">×</button></div><div class="modal-body" id="preview-body"></div><div class="modal-footer" id="preview-actions"><button id="preview-export" class="btn preview-action-button"><span class="preview-action-icon" aria-hidden="true">📄</span><span>Exportar PDF</span></button> <button id="preview-print" class="btn secondary preview-action-button"><span class="preview-action-icon" aria-hidden="true">🖨</span><span>Imprimir</span></button></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event=>{
      if(event.target === modal) modal.classList.remove('show');
    });
  }
  const body = modal.querySelector('#preview-body');
  const footer = modal.querySelector('#preview-actions');
  footer.querySelectorAll('[data-preview-action]').forEach(button=>button.remove());
  actions.forEach((action, index)=>{
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn preview-action-button ${action.className || ''}`;
    const icon = action.icon || (action.label.toLocaleLowerCase().includes('factura') ? '$'
      : action.label.toLocaleLowerCase().includes('modificar') ? '✎'
      : action.label.toLocaleLowerCase().includes('eliminar') ? '🗑'
      : '⚙');
    button.innerHTML = `<span class="preview-action-icon" aria-hidden="true">${icon}</span><span>${action.label}</span>`;
    button.dataset.previewAction = String(index);
    button.addEventListener('click', async ()=>{
      modal.classList.remove('show');
      await action.handler();
    });
    footer.insertBefore(button, footer.querySelector('#preview-export'));
  });
  body.innerHTML = html;
  modal.classList.add('show');
  modal.querySelector('#preview-close').onclick = ()=> modal.classList.remove('show');
  modal.querySelector('#preview-export').onclick = async ()=>{
    try{
      await html2pdf().from(body).set({ margin:10, filename }).save();
    }catch(e){ showToast('Error generando PDF', 'error'); }
  };
  modal.querySelector('#preview-print').onclick = ()=>{
    const w = window.open('about:blank','_blank');
    w.document.write(`<html><head><title>${filename}</title></head><body>${body.innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>{ w.print(); }, 500);
  };
}

async function previewBudget(budgetId){
  const b = await GenalDB.get('budgets', budgetId);
  if(!b){ showToast('Presupuesto no encontrado', 'error'); return; }
  const client = await GenalDB.get('clients', b.clientId);
  const sourcePart = b.fromPart ? await GenalDB.get('parts', b.fromPart) : null;
  const linkedInvoice = (await GenalDB.getAll('invoices')).find(invoice=>Number(invoice.fromBudget) === Number(budgetId));
  const cfg = await getConfig();
  const company = cfg.company || {};
  const logoSrc = cfg.logo || window._pendingLogoDataUrl || '';
  let html = documentStart();
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">`;
  if(logoSrc){ html += `<div style="flex:0 0 160px"><img src=\"${logoSrc}\" alt=\"logo\" style=\"max-height:80px;max-width:160px;object-fit:contain\"></div>`; }
  html += `<div style="flex:1;text-align:right">`;
  html += `<strong>${company.name||'Mi Empresa'}</strong><br>`;
  const addrParts = [];
  if(company.address) addrParts.push(company.address);
  const loc = [company.postal, company.city, company.province].filter(Boolean).join(' ');
  if(loc) addrParts.push(loc);
  if(addrParts.length) html += addrParts.join('<br>') + '<br>';
  if(company.tax) html += `CIF/NIF: ${company.tax}<br>`;
  if(company.phone) html += `Tel: ${company.phone} `;
  if(company.email) html += `${company.email}<br>`;
  html += `</div></div>`;
  html += `<h3 style=\"margin:8px 0\">Presupuesto ${b.number}</h3>`;
  const clientAddress = [
    client?.address,
    [client?.postalCode, client?.locality, client?.province].filter(Boolean).join(' ')
  ].filter(Boolean);
  html += `<p><strong>Cliente:</strong> ${getClientDisplayName(client)}<br>
    <strong>Dirección:</strong> ${client?.address || '—'}<br>
    <strong>Localidad:</strong> ${client?.locality || '—'}<br>
    <strong>Provincia:</strong> ${client?.province || '—'}<br>
    <strong>Código postal:</strong> ${client?.postalCode || '—'}</p>`;
  html += `<p><strong>Fecha:</strong> ${new Date(b.createdAt).toLocaleString()}</p>`;
  if(sourcePart?.technicianWork) html += `<h3>Trabajos realizados</h3><p style="white-space:pre-wrap">${sourcePart.technicianWork}</p>`;
  html += `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;border-bottom:1px solid #ccc">Descripción</th><th style="border-bottom:1px solid #ccc">Cant.</th><th style="border-bottom:1px solid #ccc">P.Unit</th><th style="border-bottom:1px solid #ccc">Total</th></tr></thead><tbody>`;
  for(const l of b.lines){ html += `<tr><td style="padding:6px 0">${l.desc||''}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">${Number(l.price||0).toFixed(2)}</td><td style="text-align:right">${Number(l.qty*l.price||0).toFixed(2)}</td></tr>`; }
  html += `</tbody></table>`;
  html += `<p style="text-align:right"><strong>Subtotal:</strong> ${Number(b.subtotal||0).toFixed(2)} ${cfg.currency} <br><strong>IVA ${b.vat_percent}%:</strong> ${Number(b.vatAmount||0).toFixed(2)} ${cfg.currency} <br><strong>Total:</strong> ${Number(b.total||0).toFixed(2)} ${cfg.currency}</p>`;
  html += `</div>`;
  const budgetActions = [
    {label:'Modificar presupuesto', className:'edit-action', handler:()=>openBudgetFromBudgetModal(budgetId)}
  ];
  if(!linkedInvoice) budgetActions.push({label:'Crear factura', className:'invoice-action', handler:()=>createInvoiceFromBudget(budgetId)});
  showPreview(html, `${b.number}.pdf`, budgetActions);
  document.querySelectorAll('#preview-body [data-open-invoice]').forEach(button=>button.addEventListener('click', async ()=>{
    document.getElementById('preview-modal')?.classList.remove('show');
    await openRecordPreview('invoices', Number(button.dataset.openInvoice));
  }));
  document.querySelectorAll('#preview-body [data-open-part]').forEach(button=>button.addEventListener('click', async ()=>{
    document.getElementById('preview-modal')?.classList.remove('show');
    await openRecordPreview('parts', Number(button.dataset.openPart));
  }));
}

async function previewInvoice(invoiceId){
  const inv = await GenalDB.get('invoices', invoiceId);
  if(!inv){ showToast('Factura no encontrada', 'error'); return; }
  const client = await GenalDB.get('clients', inv.clientId);
  const cfg = await getConfig();
  const company = cfg.company || {};
  const logoSrc = cfg.logo || window._pendingLogoDataUrl || '';
  let html = documentStart();
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">`;
  if(logoSrc){ html += `<div style="flex:0 0 160px"><img src=\"${logoSrc}\" alt=\"logo\" style=\"max-height:80px;max-width:160px;object-fit:contain\"></div>`; }
  html += `<div style="flex:1;text-align:right">`;
  html += `<strong>${company.name||'Mi Empresa'}</strong><br>`;
  const addrPartsI = [];
  if(company.address) addrPartsI.push(company.address);
  const locI = [company.postal, company.city, company.province].filter(Boolean).join(' ');
  if(locI) addrPartsI.push(locI);
  if(addrPartsI.length) html += addrPartsI.join('<br>') + '<br>';
  if(company.tax) html += `CIF/NIF: ${company.tax}<br>`;
  if(company.phone) html += `Tel: ${company.phone} `;
  if(company.email) html += `${company.email}<br>`;
  html += `</div></div>`;
  html += `<h3 style=\"margin:8px 0\">Factura ${inv.number}</h3>`;
  html += `<p><strong>Cliente:</strong> ${getClientDisplayName(client)}<br>
    <strong>Dirección:</strong> ${client?.address || '—'}<br>
    <strong>Localidad:</strong> ${client?.locality || '—'}<br>
    <strong>Provincia:</strong> ${client?.province || '—'}<br>
    <strong>Código postal:</strong> ${client?.postalCode || '—'}<br>
    <strong>DNI / NIF:</strong> ${client?.dni || '—'}<br>
    <strong>Teléfono:</strong> ${client?.phone || client?.contact || '—'}${client?.email ? `<br><strong>Email:</strong> ${client.email}` : ''}</p>`;
  html += `<p><strong>Fecha:</strong> ${new Date(inv.createdAt).toLocaleString()}</p>`;
  html += `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;border-bottom:1px solid #ccc">Descripción</th><th style="border-bottom:1px solid #ccc">Cant.</th><th style="border-bottom:1px solid #ccc">P.Unit</th><th style="border-bottom:1px solid #ccc">Total</th></tr></thead><tbody>`;
  for(const l of inv.lines){ html += `<tr><td style="padding:6px 0">${l.desc||''}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">${Number(l.price||0).toFixed(2)}</td><td style="text-align:right">${Number(l.qty*l.price||0).toFixed(2)}</td></tr>`; }
  html += `</tbody></table>`;
  html += `<p style="text-align:right"><strong>Subtotal:</strong> ${Number(inv.subtotal||0).toFixed(2)} ${cfg.currency} <br><strong>IVA ${inv.vat_percent}%:</strong> ${Number(inv.vatAmount||0).toFixed(2)} ${cfg.currency} <br><strong>Total:</strong> ${Number(inv.total||0).toFixed(2)} ${cfg.currency}</p>`;
  html += `</div>`;
  showPreview(html, `${inv.number}.pdf`, [
    {label: inv.issued ? 'Desmarcar emitida' : 'Marcar emitida', handler:async ()=>{
      if(inv.issued && !await showConfirmModal(`¿Quieres desmarcar como emitida la factura ${inv.number || ''}?`, 'Desmarcar emitida')) return;
      inv.issued = !inv.issued;
      await GenalDB.put('invoices', inv);
      renderInvoicesList();
      await previewInvoice(invoiceId);
    }},
    {label: inv.paid ? 'Marcar pendiente' : 'Marcar cobrada', handler:async ()=>{
      if(inv.paid && !await showConfirmModal(`¿Quieres desmarcar como cobrada la factura ${inv.number || ''}?`, 'Desmarcar cobrada')) return;
      inv.paid = !inv.paid;
      await GenalDB.put('invoices', inv);
      renderInvoicesList();
      await previewInvoice(invoiceId);
    }}
  ]);
}

/* Settings */
async function saveSettings(){
  const cur = document.getElementById('s-currency').value.trim() || 'EUR';
  const vat = Number(document.getElementById('s-vat').value) || 0;
  const cfg = await GenalDB.get('settings','config');
  cfg.currency = cur; cfg.vat_percent = vat;
  cfg.streetTechnicianMode = Boolean(document.getElementById('s-street-technician-mode')?.checked);
  // company fields
  cfg.company = cfg.company || {};
  cfg.company.name = document.getElementById('company-name').value.trim();
  cfg.company.address = document.getElementById('company-address').value.trim();
  cfg.company.postal = document.getElementById('company-postal').value.trim();
  cfg.company.city = document.getElementById('company-city').value.trim();
  cfg.company.province = document.getElementById('company-province').value.trim();
  cfg.company.tax = document.getElementById('company-tax').value.trim();
  cfg.company.phone = document.getElementById('company-phone').value.trim();
  cfg.company.email = document.getElementById('company-email').value.trim();
  // logo: if a new one was selected and read to window._pendingLogoDataUrl, save it
  if(window._pendingLogoDataUrl){ cfg.logo = window._pendingLogoDataUrl; delete window._pendingLogoDataUrl; }
  await GenalDB.put('settings', cfg);
  await updateHeaderLogo();
  showToast('Ajustes guardados');
}

async function exportData(){
  const products = await GenalDB.getAll('products');
  const clients = await GenalDB.getAll('clients');
  const parts = await GenalDB.getAll('parts');
  const budgets = await GenalDB.getAll('budgets');
  const invoices = await GenalDB.getAll('invoices');
  const moves = await GenalDB.getAll('moves');
  const appointments = await GenalDB.getAll('appointments');
  const settings = await GenalDB.get('settings','config');
  const data = { products, clients, parts, budgets, invoices, moves, appointments, settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = 'genalsat-backup.json'; document.body.appendChild(a); a.click(); a.remove();
}

async function importData(e){
  const f = e.target.files[0]; if(!f) return; const txt = await f.text();
  try{
    const obj = JSON.parse(txt);
    // simple import: clear and insert
    if(confirm('La importación añadirá los datos del archivo al almacén actual. ¿Deseas continuar?')){
      // naive approach: add each item
      for(const p of obj.products||[]) await GenalDB.add('products', p);
      for(const c of obj.clients||[]) await GenalDB.add('clients', c);
      for(const pa of obj.parts||[]) await GenalDB.add('parts', pa);
      for(const budget of obj.budgets||[]) await GenalDB.add('budgets', budget);
      for(const invoice of obj.invoices||[]) await GenalDB.add('invoices', invoice);
      for(const move of obj.moves||[]) await GenalDB.add('moves', move);
      for(const appointment of obj.appointments||[]) await GenalDB.add('appointments', appointment);
      if(obj.settings) await GenalDB.put('settings', obj.settings);
      showToast('Importación finalizada. Recargando vistas.');
      location.reload();
    }
  }catch(err){
    console.error('No se pudo importar la copia de seguridad.', err);
    showToast(`No se pudo importar la copia: ${err.message || 'archivo inválido'}`, 'error');
  }
}
